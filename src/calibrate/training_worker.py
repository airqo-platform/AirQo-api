"""Run with python training_worker.py; start more processes for more capacity."""

import io
import logging
import threading

import pandas as pd
from dotenv import load_dotenv

from training_core import prepare_training, train_reference_models
from training_store import TrainingStore

logger = logging.getLogger(__name__)


def process_one(store):
    job = store.claim()
    if job is None:
        return False
    logger.info("Training job %s started (attempt %s)", job["_id"], job["attempts"])
    stopped = threading.Event()

    def keep_lease():
        while not stopped.wait(30):
            try:
                if not store.heartbeat(job):
                    return
            except Exception:
                logger.exception("Heartbeat failed for job %s", job["_id"])
                return

    thread = threading.Thread(target=keep_lease, daemon=True)
    thread.start()
    try:
        with store.files.get(job["input_id"]) as source:
            frame = pd.read_csv(io.BytesIO(source.read()))
        data, pollutants, interval = prepare_training(frame, job["options"])
        summary, result, artifact = train_reference_models(data, pollutants, interval)
        store.complete(job, summary, result, artifact)
        logger.info("Training job %s completed", job["_id"])
    except (ValueError, pd.errors.ParserError, UnicodeDecodeError) as error:
        logger.warning("Invalid training input for job %s: %s", job["_id"], error)
        store.fail(job, str(error))
    except Exception:
        logger.exception("Training failed for job %s", job["_id"])
        store.fail(job, "Training failed; contact support with the job ID.")
    finally:
        stopped.set()
        thread.join(timeout=2)
    return True


def main():
    load_dotenv()
    logging.basicConfig(level=logging.INFO)
    store = TrainingStore()
    try:
        while True:
            try:
                store.cleanup()
                if not process_one(store):
                    threading.Event().wait(2)
            except Exception:
                logger.exception("Training queue unavailable; retrying in five seconds")
                threading.Event().wait(5)
    except KeyboardInterrupt:
        logger.info("Worker stopped; unfinished jobs will be reclaimed after the lease expires")
    finally:
        store.close()


if __name__ == "__main__":
    main()
