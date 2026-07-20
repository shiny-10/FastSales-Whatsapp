from __future__ import annotations
from apscheduler.schedulers.background import BackgroundScheduler
from services.campaign_service import process_scheduled_campaigns
from services.inbox_scheduler_service import process_due_messages

scheduler = BackgroundScheduler()

def start_scheduler():
    scheduler.add_job(
        process_scheduled_campaigns,
        "interval",
        seconds=10
    )
    scheduler.add_job(
        process_due_messages,
        "interval",
        seconds=30
    )

    scheduler.start()

    print("Scheduler Started")