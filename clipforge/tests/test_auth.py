import base64

from app import settings


def test_no_password_means_open(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/health").json()["password_protected"] is False


def test_password_required_when_set(client, monkeypatch):
    monkeypatch.setattr(settings, "PASSWORD", "hunter2")
    assert client.get("/").status_code == 401
    r = client.get("/api/health")
    assert r.status_code == 401 and r.headers["www-authenticate"].startswith("Basic")
    bad = base64.b64encode(b"me:wrong").decode()
    assert client.get("/api/health", headers={"Authorization": f"Basic {bad}"}).status_code == 401
    good = base64.b64encode(b"anyone:hunter2").decode()
    r = client.get("/api/health", headers={"Authorization": f"Basic {good}"})
    assert r.status_code == 200 and r.json()["password_protected"] is True


def test_low_power_overrides(monkeypatch):
    monkeypatch.setattr(settings, "LOW_POWER", True)
    settings.load_config.cache_clear()
    try:
        assert settings.load_config("platforms")["defaults"]["placement"] == "universal"
        assert settings.load_config("platforms")["defaults"]["render_preset"] == "ultrafast"
        assert settings.load_config("scoring")["max_clips"] == 4
    finally:
        settings.load_config.cache_clear()
    monkeypatch.setattr(settings, "LOW_POWER", False)
    monkeypatch.setattr(settings, "PLACEMENT", "universal")
    settings.load_config.cache_clear()
    try:
        assert settings.load_config("platforms")["defaults"]["placement"] == "universal"
        assert settings.load_config("scoring")["max_clips"] == 8
    finally:
        monkeypatch.setattr(settings, "PLACEMENT", "")
        settings.load_config.cache_clear()
