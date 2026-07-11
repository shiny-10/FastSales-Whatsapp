from apscheduler.schedulers.background import BackgroundScheduler
from services.campaign_service import process_scheduled_campaigns

scheduler = BackgroundScheduler()


def start_scheduler():
    scheduler.add_job(
        process_scheduled_campaigns,
        "interval",
        seconds=10
    )

    scheduler.start()

    print("Scheduler Started")