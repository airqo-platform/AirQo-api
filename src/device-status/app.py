import argparse
from flask import Flask
from config import db_connection
from controllers import status
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import constants, db_connection
from dotenv import load_dotenv
load_dotenv()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the status.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    status.compute_device_channel_status(args.tenant)
