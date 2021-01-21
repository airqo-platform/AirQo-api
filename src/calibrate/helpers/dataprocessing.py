import pandas as pd
from google.cloud import bigquery
import numpy as np
import pickle
#import gpflow
from datetime import datetime,timedelta
import matplotlib.pyplot as plt
#from gpflow.utilities import print_summary
import download_airnow_web
import pyproj
from glob import glob

def processBAMdata(pathtofolders,channelids):
    """
    Process the downloaded data from google drive containing BAM data.
    The BAM data is organised into folders, such as:
        rootfolder/Y24516 Makerere BAM/20200730/DT091755.CSV
    the root folder also contains a metadata file that stores the
    latitude, longitude and time of the sensors.
    pathtofolders = the path to the root folder
    channelids = dictionary of what numeric id to give each sensor, for example:
        {'Y24517':-24517,'Y24516':-24516}
    Returns a dataframe of BAM data, with only status=0 rows.
    """
    metadf = pd.read_excel(pathtofolders+'/BAM Metadata.xlsx')
    print("Device Ids: ")
    print(metadf['Id'].unique())
    allbamdf = []
    for fn in glob(pathtofolders+'/*/*/*.CSV'):
        bamdf = pd.read_csv(fn,skiprows=5)
        ch_id = fn[len(pathtofolders)+1:].split('/')[0].split(' ')[0]
        thismetadf = metadf[metadf['Id']==ch_id]
        bamdf = bamdf[bamdf['Status']==0]
        bamdf['latitude']=thismetadf['Latitude'].iloc[0]
        bamdf['longitude']=thismetadf['Longitude'].iloc[0]
        bamdf['pm2_5'] = bamdf['ConcHR(ug/m3)']
        bamdf['created_at'] = bamdf['Time']
        bamdf['channel_id'] = channelids[ch_id]
        allbamdf.append(bamdf)
    return pd.concat(allbamdf)
    
def loaddata(bigquery_account_json,nextdays=5):
    """
    Load data from main GCP database.
    Pass it the path to your CGP key.
    Returns a dataframe of all the sensor data.
    
    Currently this version just downloads the next five days of data from the oldest data in the cache.
    If you want to download more, change 'nextdays' parameter to a larger number. If you set it to, for
    example 30000 it will download all the data.
    """
    client = bigquery.Client.from_service_account_json(bigquery_account_json)
    try:
        df = pickle.load(open('alldata.p','rb'))
        mostrecent = df['created_at'].max()
        nexttimestep = mostrecent + pd.Timedelta(nextdays,'day')
        mostrecent = mostrecent.strftime('%Y-%m-%d')
        
        
        nexttimestep = nexttimestep.strftime('%Y-%m-%d')
        print("Found cache file containing data up to %s" % mostrecent)
        print("Downloading more data to date %s" % nexttimestep)
        sql = """SELECT * FROM `airqo-250220.thingspeak.clean_feeds_pms` WHERE (created_at >= DATETIME('%s')) AND (created_at < DATETIME('%s'))""" % (mostrecent,nexttimestep)
        print("SQL query:")
        print(sql)
        d = client.query(sql)
        print("Query complete, converting to dataframe...")
        d = d.to_dataframe()     
        print("done")
        print(d)
        print("Concatenating with cached data...")
        df = pd.concat([df,d]) #ugh, memory issues: https://www.confessionsofadataguy.com/solving-the-memory-hungry-pandas-concat-problem/
        print("Dropping duplicates...")
        df = df.drop_duplicates() #we are likely to have duplicates as the create_at threshold is a bit vague
    except FileNotFoundError:
        print("cache file ('alldata.p') not found. Downloading entire dataset, this may take some time.")
        sql = """SELECT * FROM `airqo-250220.thingspeak.clean_feeds_pms`"""
        df = client.query(sql).to_dataframe()
    print("Saving new cache")
    pickle.dump(df,open('alldata.p','wb'))
    return df

def combinedatasets(df,otherdf, distfromboxcentre = 40e3, boxlat=0.313611, boxlong=32.581111):
    """
    Merge 'otherdf' into 'df'.
    Only include data from either that is within distfromboxcentre (in metres) from boxlat and boxlong.
    Adds x and y columns for Northings and Eastings.
    """

    df = pd.concat([df, otherdf[['created_at','channel_id','pm2_5','latitude','longitude']]])
    #Convert to northings and eastings
    epsg3857 = pyproj.Proj(init='epsg:3857') #EPSG:3857 -- WGS84 Web Mercator [used by websites]
    wgs84 = pyproj.Proj(init='EPSG:4326') #WGS 84 [used by GPS satellite system]
    boxcentre = pyproj.transform(wgs84,epsg3857,boxlong,boxlat)
    longs = df['longitude'].tolist()
    lats = df['latitude'].tolist()

    df['x'],df['y'] = pyproj.transform(wgs84,epsg3857,longs,lats)

    #Only keep items that are in a box around Kampala
    df = df[(df['x']>boxcentre[0]-distfromboxcentre)]
    df = df[(df['x']<boxcentre[0]+distfromboxcentre)]
    df = df[(df['y']>boxcentre[1]-distfromboxcentre)]
    df = df[(df['y']<boxcentre[1]+distfromboxcentre)]
    return df

def build_encounters(df,prox = 20,timeprox = 30):
    """
    Build a new dataframe containing the pairs of measurements that happen near each other.
    
    Input dataframe needs these columns:
        channel_id
        created_at
        latitude (lat/long only included to check they are 'sensible' and not NAN)
        longitude
        pm2_5
        x (Easting and Northing in m)
        y        
    prox = proximity in metres
    timeprox = proximity in minutes
    
    Returns a dataframe containing two copies of all the columns of the original (one for each sensor)
    with additionally a column for timedelta and dist (in m) between the two observations.
    """
    dfs = []
    encounters = None
    for cid in df['channel_id'].unique():
        df['created_at_2']=df['created_at']
        dfs.append(df[df['channel_id']==cid])
    for i,d1 in enumerate(dfs):
        #for d2 in dfs[i+1:]:
        for j,d2 in enumerate(dfs):
            if i==j:continue
            newdf = pd.merge_asof(d1.sort_values("created_at"),d2.sort_values("created_at"),on='created_at',tolerance=pd.Timedelta(timeprox,'minutes'),direction='nearest',suffixes=('_sensorA', '_sensorB')). \
                dropna(subset=["created_at","created_at_2_sensorA",'latitude_sensorA','longitude_sensorA', 'latitude_sensorB', 'longitude_sensorB','pm2_5_sensorA','pm2_5_sensorB'])
            #leaving this line in might make it quicker, as I compute a sqrt (somewhat unnecessarily for a lot of data)
            #newdf = newdf[(np.abs(newdf['x_sensorA']-newdf['x_sensorB'])<prox) & (np.abs(newdf['y_sensorA']-newdf['y_sensorB'])<prox)]
            newdf['dist'] = np.sqrt((newdf['x_sensorA']-newdf['x_sensorB'])**2 + (newdf['y_sensorA']-newdf['y_sensorB'])**2)
            newdf = newdf[newdf['dist']<prox]
            newdf['timedelta'] = np.abs(newdf['created_at_2_sensorA']-newdf['created_at_2_sensorB'])
            encounters = pd.concat([encounters,newdf])
        print("%d of %d (%d encounters recorded)" % (i+1,len(dfs),len(encounters)))
    return encounters

def plotsensorencounters(df,box=100,plotunq=None):
    """
    For each sensor find its median location and plot all the sensors around it over all time.
    This just was useful to confirm that sensor visits were as intended.
    """
    i=0
    if plotunq is None: plotunq = df['channel_id'].unique()
    rows=int(np.floor(np.sqrt(len(plotunq))))
    cols=np.ceil(len(plotunq)/rows)
    
    for cid in plotunq:
        i+=1
        boxc=[0,0]
        boxc[0] = np.median(df[df['channel_id']==cid]['x'])
        boxc[1] = np.median(df[df['channel_id']==cid]['y'])
        ax = plt.subplot(rows,cols,i)
        epsg3857 = pyproj.Proj(init='epsg:3857') #EPSG:3857 -- WGS84 Web Mercator [used by websites]
        wgs84 = pyproj.Proj(init='EPSG:4326') #WGS 84 [used by GPS satellite system]
        longlatcentre = pyproj.transform(epsg3857,wgs84,boxc[0],boxc[1])
        longlatbox = [pyproj.transform(epsg3857,wgs84,boxc[0]-box,boxc[1]-box),pyproj.transform(epsg3857,wgs84,boxc[0]+box,boxc[1]+box)]
        extent = tilemapbase.Extent.from_lonlat(longlatbox[0][0], longlatbox[1][0],longlatbox[0][1],longlatbox[1][1])        
        ax.xaxis.set_visible(False)
        ax.yaxis.set_visible(False)
        plotter = tilemapbase.Plotter(extent, t, width=600)
        plotter.plot(ax, t)
        if cid in [930428,930430]: continue
        centre = tilemapbase.project(longlatcentre[0],longlatcentre[1])
        plt.plot(centre[0],centre[1],'k+',markersize=100)
        for channel_id in unq:
            #print(channel_id)
            chandf = df[df['channel_id']==channel_id]
            chandf = chandf[(chandf['x']>boxc[0]-box) & (chandf['x']<boxc[0]+box) & (chandf['y']>boxc[1]-box) & (chandf['y']<boxc[1]+box)]
            if channel_id<0:
                dotsize = 25
            else:
                dotsize = 15
            if len(chandf)>0:
                longlats = pyproj.transform(epsg3857,wgs84,np.array(chandf['x']),np.array(chandf['y']))
                x,y = 0,0 
                plotcoords = np.array([tilemapbase.project(lon,lat) for lon,lat in zip(longlats[0],longlats[1])])
                #print(plotcoords)
                #plt.plot(x,y,label="%d (%d)" % (channel_id,len(chandf)))
                plt.scatter(plotcoords[:,0],plotcoords[:,1],dotsize,label="%d (%d)" % (channel_id,len(chandf)))
                #plt.scatter(chandf['x'],chandf['y'],dotsize,label="%d (%d)" % (channel_id,len(chandf)))
        plt.legend()
        #plt.xlim([boxc[0]-box,boxc[0]+box])
        #plt.ylim([boxc[1]-box,boxc[1]+box])
        plt.title(cid)
        #plt.plot(embassyxy['x'],embassyxy['y'],'x',markersize=20)
        plt.grid()
