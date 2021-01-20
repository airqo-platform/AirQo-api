import numpy as np
import networkx as nx
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit

def f(x,a,b):
    """
    Experimental - calibration function [not used in main code yet]
    """
    return x*a+b
    
def compute_simple_calibration(X,Y,delta,refsensor,mincolocationsinperiod=3):
    """
    Computes scalings of each sensor using the network of colocated observations
    to connect reference sensors to other sensors by following a shortest path
    through the network (over time and connections).
    
    X = An Nx3 matrix of [time, sensoridA, sensoridB]
    Y = An Nx2 matrix of measured values at sensorA and sensorB.
    delta = how long (in the same units of time as in X[:,0]) are the 'chunks'?
    refsensor = a binary vector of whether a sensor is a reference sensor or not.
    
    Returns a lot of debug content at the moment:
    G - the graph of the 'connections' between sensors [debug]
    allsp - shortest paths [debug]
    allcals - [useful!] A dictionary of calibrations. Each item in the dictionary
       is indexed by a tuple of (sensorid, timechunk) pairs. Each dictionary entry
       is the log scaling that needs to be applied to get the predicted true value.
       For example if the value is -0.5, then exp(-0.5)*measured_value would be
       predicted.
    allcallists,allpopts,allpcovs,allpoptslists - more debug. Ignore.
    """
    G = nx.DiGraph()
    maxnum = int(np.max(X[:,1:]))
    #data = np.full([maxnum+1,maxnum+1],np.NaN)
    for it,starttime in enumerate(np.arange(0,np.max(X[:,0]),delta)):
        keep = (X[:,0]>starttime) & (X[:,0]<starttime+delta)
        Xkeep = X[keep,:]
        Ykeep = Y[keep,:]
        for i in range(maxnum+1):
            for j in range(maxnum+1):
                keep = (Xkeep[:,1]==i) & (Xkeep[:,2]==j)
                if len(Ykeep[keep,0])>mincolocationsinperiod: #need a few data points for confidence?
                    logratio=np.nanmean(np.log(Ykeep[keep,0]/Ykeep[keep,1]))
                    popt, pcov = curve_fit(f,Ykeep[keep,1],Ykeep[keep,0])
                    G.add_edge((i,it),(j,it),val=logratio,popt=popt,pcov=pcov,weight=2)
                    popt, pcov = curve_fit(f,Ykeep[keep,0],Ykeep[keep,1])
                    G.add_edge((j,it),(i,it),val=-logratio,popt=popt,pcov=pcov,weight=2)
    maxit = it
    for it,starttime in enumerate(np.arange(0,np.max(X[:,0])+delta,delta)):
        if it>0:
            for i in range(maxnum+1):
                #if np.all(np.isnan(data[i,:])): continue
                if np.any([(i,j) in G.nodes for j in range(maxit)]):
                    popt = np.array([0,0])
                    pcov = np.eye(2)
                    G.add_edge((i,it-1),(i,it),val=0,popt=popt,pcov=pcov,weight=1)
                    G.add_edge((i,it),(i,it-1),val=0,popt=popt,pcov=pcov,weight=1)
                    
    allsp = {}
    for ref in np.where(refsensor)[0]:
        for timeidx in range(maxit+1):

            #sp = nx.shortest_paths.single_target_shortest_path(G,(ref,timeidx))
            sp = nx.shortest_paths.single_source_dijkstra_path(G,(ref,timeidx))
            for s in sp:
                if s in allsp:
                    if len(sp[s])<len(allsp[s]):
                        allsp[s]=sp[s]
                else:
                    allsp[s]=sp[s]
    allcals = {}
    allcallists = {}
    allpopts = {}
    allpcovs = {}
    allpoptslists = {}
    for s in allsp:
        allcallists[s] = [G.get_edge_data(u,v)['val'] for u,v in zip(allsp[s][:-1],allsp[s][1:])]
        allcals[s] = np.sum([G.get_edge_data(u,v)['val'] for u,v in zip(allsp[s][:-1],allsp[s][1:])])
        allpoptslists[s] = [G.get_edge_data(u,v)['popt'] for u,v in zip(allsp[s][:-1],allsp[s][1:])]
        allpopts[s] = np.sum(np.log([G.get_edge_data(u,v)['popt'] for u,v in zip(allsp[s][:-1],allsp[s][1:])]),0)
        allpcovs[s] = np.sum([G.get_edge_data(u,v)['pcov'] for u,v in zip(allsp[s][:-1],allsp[s][1:])],0)

        #allpopt
    return G,allsp,allcals,allcallists,allpopts,allpcovs,allpoptslists

def plot_simple_calibration_graph(G):
    """
    Plot the graph.
    """
    plt.figure(figsize=[15,15])
    #cols = np.array([1 if (n[0]==maxnum) else 0.5 for n in G.nodes])
    #cols += 0.3*np.array([1 if (n[0]==maxnum-1) else 0 for n in G.nodes])
    nx.draw_networkx(G,pos=nx.spring_layout(G))#,node_color=cols)#draw_networkx_edge_labels(G,pos=nx.spring_layout(G))

def compute_simple_predictions(testX,testY,testtrueY,allcals,delta):
    """
    testX: An Nx2 or Nx3 matrix.
            First column is time (e.g. seconds or hours since epoch)
            Second column is the id of the sensor.
                It might be a 3 column matrix, we just use the first two: datetime and sensor id.
    testY: The measured values of that sensor.
    truetestY: The true values of pollution there.
    allcals: A dictionary of calibrations. Each item in the dictionary is indexed by a tuple of (sensorid, timechunk) pairs.
       Each dictionary entry is the log scaling that needs to be applied to get the predicted true value.
       For example if the value is -0.5, then exp(-0.5)*measured_value would be predicted.
       
    Returns preds: a vector of predictions for all the tests.
    Returns res2 and res: temporary returned values for debugging."""
    idx = (testX[:,0]/delta).astype(int)
    preds = np.full_like(testtrueY,np.NaN)
    res = []
    res2 = []
    for i,(timeidx,sensorid0,test0,true) in enumerate(zip(idx,testX[:,1],testY[:,0],testtrueY[:,0])):
        #if test0==true: #no point really in testing on when we know the true value
        #    continue
        if np.isnan(true): continue
        #temp.append(sensorid0)
        #print((sensorid0,timeidx))
        scaling = np.exp(allcals[(sensorid0,timeidx)])
        preds[i] = scaling*test0
        #print("\nmeasurement:",test0,"\nsensorid:",sensorid0,"\npath:",allsp[(sensorid0,timeidx)],"\nlist:",allcallists[(sensorid0,timeidx)],"\noverall calibration:",allcals[(sensorid0,timeidx)],"\nscaling:",scaling,"\nprediction:",scaling*test0,"\ntruth:",true)
        res2.append([scaling*test0,true])
        res.append([test0,true])
        #print(test1,allcals[(sensorid1,timeidx)],np.exp(-allcals[(sensorid1,timeidx)])*test1,true)
    return preds,res2,res
