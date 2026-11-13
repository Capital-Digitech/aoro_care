"""
One-time helper: adds the 4 sleep-stage columns to the health_data table.

Run ONCE, before starting the server with the new models.py:

    py add_sleep_columns.py

Safe to run again: columns that already exist are skipped. It only ADDS empty
columns, nothing is changed or deleted.
"""

import io
import contextlib

from sqlalchemy import inspect, text

with contextlib.redirect_stdout(io.StringIO()):
    from app import app

from database import db

COLUMNS = [
    "sleep_deep_hours",
    "sleep_light_hours",
    "sleep_rem_hours",
    "sleep_awake_hours",
]

with app.app_context():
    existing = {c["name"] for c in inspect(db.engine).get_columns("health_data")}

    for name in COLUMNS:
        if name in existing:
            print(f"{name}: already there")
            continue
        db.session.execute(text(f"ALTER TABLE health_data ADD COLUMN {name} DOUBLE PRECISION"))
        print(f"{name}: added")

    db.session.commit()

print("Done.")
