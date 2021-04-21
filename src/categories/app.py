import argparse
from flask import Flask
import logging
import os
from controllers import category
from dotenv import load_dotenv
load_dotenv()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the category count.')
    parser.add_argument('--tenant',
                        default="kcca",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    category.get_pm25categorycount_for_locations(args.tenant)
