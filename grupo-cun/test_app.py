"""Prueba de humo: python -m unittest test_app (desde grupo-cun/)."""
import io
import os
import re
import tempfile
import unittest
from datetime import timedelta

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or "sqlite:///" + os.path.join(_tmp, "test.db")
os.environ["GROUP_CODE"] = "codigo-prueba"

from app import app, now_local  # noqa: E402


class FlujoCompleto(unittest.TestCase):
    def setUp(self):
        self.c = app.test_client()

    def csrf(self, path):
        html = self.c.get(path).get_data(as_text=True)
        return re.search(r'name="csrf" value="([^"]+)"', html).group(1)

    def register(self, username, name):
        token = self.csrf("/registro")
        return self.c.post("/registro", data={
            "csrf": token, "group_code": "codigo-prueba", "username": username,
            "name": name, "password": "secreto123", "whatsapp": "3001234567"})

    def test_flujo(self):
        # Sin sesión manda a entrar
        self.assertEqual(self.c.get("/").status_code, 302)
        # Código malo no deja registrarse
        token = self.csrf("/registro")
        r = self.c.post("/registro", data={"csrf": token, "group_code": "otro", "username": "x1",
                                          "name": "X", "password": "secreto123"})
        self.assertIn("código del grupo no es correcto", r.get_data(as_text=True))
        # POST sin csrf se rechaza
        self.assertEqual(self.c.post("/registro", data={}).status_code, 400)

        r = self.register("laura", "Laura Gómez")
        self.assertEqual(r.status_code, 302)
        token = self.csrf("/perfil")

        # Perfil
        r = self.c.post("/perfil", data={"csrf": token, "name": "Laura Gómez", "email": "l@x.co",
                                        "phone": "3001234567", "whatsapp": "3001234567",
                                        "birthday": "1999-02-28", "about": "Disponible noches"},
                        follow_redirects=True)
        self.assertIn("Perfil guardado", r.get_data(as_text=True))
        self.assertIn("wa.me/573001234567", self.c.get("/integrantes").get_data(as_text=True))

        # Fecha en 1 día: debe salir como alarma
        due = (now_local() + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
        r = self.c.post("/fechas/nueva", data={"csrf": token, "title": "Taller 2", "kind": "entrega",
                                              "due": due, "subject": "Estadística",
                                              "description": "Puntos 1 a 5", "link": "campus.cun.edu.co"})
        self.assertEqual(r.status_code, 302)
        home = self.c.get("/").get_data(as_text=True)
        self.assertIn("Taller 2", home)
        self.assertIn('class="badge"', home)
        alarms = self.c.get("/api/alarmas").get_json()
        self.assertEqual(alarms[0]["title"], "Taller 2")
        self.assertEqual(alarms[0]["status"], "pronto")

        detail = self.c.get("/fechas/1").get_data(as_text=True)
        self.assertIn("calendar.google.com", detail)
        self.assertIn("https://campus.cun.edu.co", detail)

        # Comentario en la fecha y en el muro
        self.c.post("/fechas/1/comentar", data={"csrf": token, "body": "Yo hago el punto 3"})
        self.assertIn("Yo hago el punto 3", self.c.get("/fechas/1").get_data(as_text=True))
        self.c.post("/muro", data={"csrf": token, "body": "Reunión el sábado", "pinned": "1"})
        self.assertIn("Reunión el sábado", self.c.get("/").get_data(as_text=True))

        # Calendario y feed .ics
        cal = self.c.get("/calendario").get_data(as_text=True)
        self.assertIn("Taller 2", cal)
        feed_url = re.search(r'value="(http[^"]+\.ics)"', cal).group(1)
        anon = app.test_client()
        ics = anon.get(feed_url.replace("http://localhost", ""))
        self.assertEqual(ics.status_code, 200)
        body = ics.get_data(as_text=True)
        self.assertIn("BEGIN:VALARM", body)
        self.assertIn("Taller 2", body)
        self.assertEqual(anon.get("/calendario/malo.ics").status_code, 404)

        # Subir archivo y link
        r = self.c.post("/archivos/subir", data={
            "csrf": token, "title": "", "category": "solucion", "subject": "Estadística",
            "file": (io.BytesIO(b"%PDF-1.4 hola"), "parcial1.pdf", "application/pdf")},
            content_type="multipart/form-data")
        self.assertEqual(r.status_code, 302)
        self.c.post("/archivos/subir", data={"csrf": token, "url": "drive.google.com/abc",
                                             "title": "Carpeta Drive", "category": "material"})
        lib = self.c.get("/archivos").get_data(as_text=True)
        self.assertIn("parcial1.pdf", lib)
        self.assertIn("Carpeta Drive", lib)
        f = self.c.get("/archivos/1/parcial1.pdf")
        self.assertEqual(f.data, b"%PDF-1.4 hola")
        self.assertIn("inline", f.headers["Content-Disposition"])
        self.assertIn("attachment", self.c.get("/archivos/1/parcial1.pdf?descargar=1").headers["Content-Disposition"])
        self.assertEqual(self.c.get("/archivos/2").headers["Location"], "https://drive.google.com/abc")
        self.assertIn("Carpeta Drive", self.c.get("/archivos?tipo=link").get_data(as_text=True))
        self.assertNotIn("Carpeta Drive", self.c.get("/archivos?tipo=archivo").get_data(as_text=True))

        # Marcar lista y borrar
        self.c.post("/fechas/1/listo", data={"csrf": token})
        self.assertEqual(self.c.get("/api/alarmas").get_json(), [])
        self.c.post("/fechas/1/borrar", data={"csrf": token})
        self.assertEqual(self.c.get("/fechas/1").status_code, 404)

        # Todas las páginas cargan
        for path in ("/", "/fechas", "/fechas?ver=todas", "/fechas/nueva", "/calendario?y=2026&m=2",
                     "/archivos", "/muro", "/integrantes", "/perfil"):
            self.assertEqual(self.c.get(path).status_code, 200, path)

        # Salir y volver a entrar
        self.c.post("/salir", data={"csrf": token})
        self.assertEqual(self.c.get("/").status_code, 302)
        token = self.csrf("/entrar")
        r = self.c.post("/entrar", data={"csrf": token, "username": "laura", "password": "secreto123"})
        self.assertEqual(r.status_code, 302)
        self.assertEqual(self.c.get("/").status_code, 200)


if __name__ == "__main__":
    unittest.main()
