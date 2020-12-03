import numpy as np
import matplotlib.pyplot as plt
from calibration.errormetrics import MAE, MSE, NMSE, NLPD, compute_test_data
from calibration.synthetic import generate_synthetic_dataset, getstaticsensortranform, getmobilesensortranform
from calibration.simple import compute_simple_calibration, compute_simple_predictions


def generate_X_Y_values(refsensor):
    #we can consider a simple network of 4 sensors.
    #colocations between 0 and 1 happened from day 1-20
    #then between 1 and 2 between 5-25,
    #then between 2 and 3 on days 15-40.
    X = np.c_[np.arange(1,21)[:,None],np.full(20,0),np.full(20,1)]
    X = np.r_[X,np.c_[np.arange(5,26)[:,None],np.full(21,1),np.full(21,2)]]
    X = np.r_[X,np.c_[np.arange(15,41)[:,None],np.full(26,2),np.full(26,3)]]
    #sensor 0 AND sensor 3 are reference sensors, but we'll only tell the model
    #about sensor 0:
    refsensor = refsensor

    #generate some synthetic pollution data
    np.set_printoptions(precision=1,suppress=True)
    Y = np.repeat(20*np.cos(X[:,0]/20)[:,None],2,1)
    Y[X[:,1:]==1]*=2
    Y[X[:,1:]==2]*=3

    #in a real scenario we will only know true pollution
    #data where a reference instrument is. To that end
    #we'll use instrument 3 (which we know is a reference
    #instrument but haven't told the model about) as a source
    #for this trueY:
    trueY = np.full(len(Y),np.nan)
    keep = X[:,2]==3
    trueY[keep]=Y[keep,1]
    trueY

    return X, Y, trueY


def calibrate_raw_data():
    refsensor = np.array([1,0,0,0])
    delta = 8    
    X, Y, trueY = generate_X_Y_values(refsensor)

    G,allsp,allcals,allcallists,allpopts,allpcovs,allpoptslists = compute_simple_calibration(X,Y,delta,refsensor,mincolocationsinperiod=1)
    testX, testY, testtrueY = compute_test_data(X,Y,trueY,refsensor)
    #we just keep those that we have a true value for 
    #AND those that aren't a reference sensor itself
    #(as this we can get 100% accuracy just by reporting
    #the same number:
    keep = (~np.isnan(testtrueY)[:,0]) & (testX[:,1]!=3)
    testX = testX[keep,:]
    testY = testY[keep,:]
    testtrueY = testtrueY[keep,:]  
    preds,res2,res = compute_simple_predictions(testX,testY,testtrueY,allcals,delta)
    return preds


if __name__ == "__main__":
    results = calibrate_raw_data()
    print(results)