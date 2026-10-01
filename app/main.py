from fastapi import FastAPI
from app.routers import auth ,reminders
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Reminder App")

app.include_router(auth.router)
app.include_router(reminders.router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://expiry-vault-web.onrender.com"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


