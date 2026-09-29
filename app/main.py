from fastapi import FastAPI
from app.routers import auth ,reminders


app = FastAPI(title="Reminder App")

app.include_router(auth.router)
app.include_router(reminders.router)



@app.get("/health")
def health():
    return {"status": "ok"}


