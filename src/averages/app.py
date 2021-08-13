import argparse
from config import db_connection
from controllers import uptime
from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import constants
from dotenv import load_dotenv
load_dotenv()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the averages.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    uptime.save_device_uptime(args.tenant)
