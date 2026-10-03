import sys
from datetime import date, timedelta

from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Reminder, SentReminder, User
from app.core.email import send_email

DAYS = [15, 3, 1]


def run(today: date) -> None:
    db = SessionLocal()
    try:
        for days in DAYS:
            target = today + timedelta(days=days)

            reminders = (
                db.query(Reminder, User)
                .join(User, Reminder.user_id == User.id)
                .filter(Reminder.expiry_date == target)
                .all()
            )

            for reminder, user in reminders:
                record = SentReminder(
                    reminder_id=reminder.id,
                    days_before=days,
                    expiry_date=reminder.expiry_date,
                )
                db.add(record)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    continue

                send_email(
                    to=user.email,
                    subject=f"{reminder.name} expires in {days} days",
                    html=(
                        f"<p><strong>{reminder.name}</strong> expires on "
                        f"{reminder.expiry_date.strftime('%d %B %Y')}.</p>"
                    ),
                )
                print(f"sent {days}d: {reminder.name} -> {user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    today = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date.today()
    run(today)