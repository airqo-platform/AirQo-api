from views.save_satellite_data import run_data_processing_job
import schedule
import time

def main():
    # Start the data processing job
    run_data_processing_job()

    # Schedule the job to run every 12 minutes
    schedule.every(12).minutes.do(run_data_processing_job)
    print('Waiting...')

    # Keep the scheduler running
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    main()
