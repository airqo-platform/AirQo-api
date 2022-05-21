import os
from dotenv import load_dotenv
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator
import requests
from datetime import datetime, timedelta
import streamlit as st

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

BASE_API_URL = os.getenv('BASE_URL')

matplotlib.use('Agg')

st.set_page_config(page_title='NETWORK UPTIME AND DOWNTIME', layout="wide")
st.title('Data report on network uptime and outages')


api_url = f"{BASE_API_URL}/devices?tenant=airqo"
results = requests.get(api_url)
devices_data = results.json()["devices"]

st.sidebar.markdown(
    "<h1 style='text-align: center;'>SELECT QUERY DATE</h1>", unsafe_allow_html=True)
side_row1_col1, side_row1_col2 = st.sidebar.columns([1, 1])
with side_row1_col1:
    selected_start_date = st.date_input(
        'start date', datetime.now() - timedelta(weeks=12))
with side_row1_col2:
    selected_end_date = st.date_input(
        'end date', datetime.now())

st.sidebar.markdown("""---""")
st.sidebar.markdown(
    "<h2 style='text-align: center;'>FILTER</h2>", unsafe_allow_html=True)
selected_start_date_formated = datetime.fromisoformat(selected_start_date.strftime(
    "%Y-%m-%d %H:%M:%S"))
selected_end_date_formated = datetime.fromisoformat(selected_end_date.strftime(
    "%Y-%m-%d %H:%M:%S"))


device_name = devices_name = [data['name'] for data in devices_data]
selected_device = st.sidebar.selectbox('Device name', device_name)


@st.cache(suppress_st_warning=True)
def load_device_data(device, startDate, endDate):
    api = f"{BASE_API_URL}/monitor/devices/uptime?tenant=airqo&startDate=" \
        + startDate.isoformat() + ".001Z&endDate=" + endDate.isoformat() \
        + ".001Z&device_name=" + device
    api_result = requests.get(api)
    try:
        values = api_result.json()['data'][0]['values']
    except:
        st.title('#')
        st.title('#')
        st.write('NO DATA AVAILABLE FOR THIS DEVICE WITHIN THE SPECIFIED DATE RANGE')
        st.stop()
    subset = ['created_at', 'uptime', 'downtime']
    data_subset_list = []
    for element in values:
        data_subset = {}
        for k in subset:
            data_subset[k] = element[k]
        data_subset_list.append(data_subset)

    return data_subset_list


def load_device_dataframe(json_data):
    device_data = pd.DataFrame(json_data)
    device_data['created_at'] = pd.to_datetime(
        device_data['created_at']).dt.date

    device_data.set_index('created_at', inplace=True)

    device_uptime_data = device_data.loc[(
        device_data.uptime == 100)]
    device_downtime_data = device_data.loc[(
        device_data.uptime == 0)]

    device_uptime_count = pd.DataFrame(device_uptime_data.groupby(
        pd.DatetimeIndex(device_uptime_data.index).date).count()['uptime'])
    device_downtime_count = pd.DataFrame(device_downtime_data.groupby(
        pd.DatetimeIndex(device_downtime_data.index).date).count()['downtime'])

    device_name_data = device_uptime_count.join(
        device_downtime_count, how='outer').fillna(0).astype(np.int32)
    #device_name_data = device_name_data.add_suffix('_count')
    device_name_data.index = pd.to_datetime(device_name_data.index)
    device_name_data['pct_uptime'] = (
        device_name_data['uptime']/device_name_data.sum(axis=1)*100).round(1)
    device_name_data['pct_downtime'] = 100 - device_name_data['pct_uptime']

    return device_name_data


json_data = load_device_data(
    device=selected_device, startDate=selected_start_date_formated, endDate=selected_end_date_formated)
device_name_data = load_device_dataframe(json_data)

device_name_data_year = device_name_data.index.year.unique()
selected_year = st.sidebar.selectbox('Year', device_name_data_year)
device_name_data_month_name = device_name_data[device_name_data.index.year ==
                                               selected_year].index.month_name().unique()
device_name_data_month = device_name_data[device_name_data.index.year ==
                                          selected_year].index.month.unique()

device_name_data_month_wrap = dict(
    zip(device_name_data_month_name, device_name_data_month))
selected_month = st.sidebar.radio('Month', device_name_data_month_name)


# Barchart
my_color = ['g', 'r']
fig_bar, axes_bar = plt.subplots(1, 1, figsize=(14, 10))
device_name_data_subset = device_name_data[(device_name_data.index.year == selected_year) & (
    device_name_data.index.month == device_name_data_month_wrap[selected_month])][['uptime', 'downtime']]

date_max_value = device_name_data_subset.index.days_in_month.unique().item()
selected_date = st.sidebar.slider(
    'day', min_value=1, max_value=date_max_value, value=date_max_value)

device_name_data_subset = device_name_data_subset[(
    device_name_data_subset.index.day >= 1) & (device_name_data_subset.index.day <= selected_date)]
device_name_data_subset.index = device_name_data_subset.index.date


device_name_data_subset.plot(kind='bar', ax=axes_bar, color=my_color)
axes_bar.yaxis.set_major_locator(MaxNLocator(integer=True))
axes_bar.set_title(
    f'{selected_device} device network uptime and downtime daily count for the month of {selected_month}, {selected_year}', fontsize=20)
plt.tight_layout(pad=5)

# Piechart

device_name_data_months_group = device_name_data.groupby(
    pd.Grouper(freq='M')).sum()[['uptime', 'downtime']]
device_name_data_months_pct = device_name_data_months_group.div(
    device_name_data_months_group.sum(axis=1), axis='rows').round(2)
fig_pie, axes_pie = plt.subplots(1, 1, figsize=(10, 8))
axes_pie.set_title(
    f'{selected_device} device network uptime and downtime percent for the month of {selected_month}, {selected_year}', fontsize=15)
device_name_data_month_pct = device_name_data_months_pct[(device_name_data_months_pct.index.year == selected_year) & (
    device_name_data_months_pct.index.month == device_name_data_month_wrap[selected_month])]

device_name_data_month_pct.T.plot.pie(
    y=device_name_data_month_pct.index[0], colors=['green', 'red'], autopct='%0.1f%%', ax=axes_pie)
axes_pie.yaxis.set_visible(False)


st.write("Daily Uptime and Downtime count for", selected_device, "device")
st.dataframe(device_name_data, height=200, width=800)
st.title('#')
st.title('#')

row_two_col = st.columns(2)
with row_two_col[0]:
    st.pyplot(fig_bar)

with row_two_col[1]:
    st.pyplot(fig_pie)

hide_streamlit_style = """
            <style>
            MainMenu {visibility: hidden;}
            footer {visibility: hidden;}
            footer:after {
            content:'Made with Streamlit'; 
            visibility: visible;
            display: block;
            position: relative;
            #background-color: red;
            padding: 5px;
            top: 2px;
            }
            </style>
            """
st.markdown(hide_streamlit_style, unsafe_allow_html=True)
