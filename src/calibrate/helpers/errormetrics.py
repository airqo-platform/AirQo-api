import numpy as np
import tensorflow_probability as tfp

def MAE(x,y):
    """Mean absolute error"""
    return np.mean(np.abs(x-y))

def MSE(x,y):
    """
    Mean Squared Error"""
    return np.mean((x-y)**2)

def NMSE(x,y):
    """Normalised Mean Squared Error
    x = correct
    y = estimate
    see https://math.stackexchange.com/questions/488964/the-definition-of-nmse-normalized-mean-square-error
    """
    return MSE(x,y)/MSE(x,0)

def NLPD(x,y,ystd):
    """(normalised) Negative Log Predictive Density
    
    Definition of Negative Log Predictive Density (NLPD):

    $$L = -\frac{1}{n} \sum_{i=1}^n \log p(y_i=t_i|\mathbf{x}_i)$$

    See http://mlg.eng.cam.ac.uk/pub/pdf/QuiRasSinetal06.pdf, page 13.

    "This loss penalizes both over and under-confident predictions."
    but
    "The NLPD loss favours conservative models, that is models that tend to beunder-confident
    rather than over-confident. This is illustrated in Fig. 7, and canbe deduced from the fact that
    logarithms are being used. An interesting way ofusing the NLPD is to give it relative to the NLPD
    of a predictor that ignoresthe inputs and always predicts the same Gaussian predictive distribution,
    withmean and variance the empirical mean and variance of the training data. Thisrelative NLPD
    translates into a gain of information with respect to the simpleGaussian predictor described."
    """
    return -np.mean(tfp.distributions.Normal(y,ystd).log_prob(x))
    
def compute_test_data(X,Y,trueY,refsensor):
    """
    This method produces test data for evaluating models.
    It returns three matrices,
         testX, testY, testtrueY.
    
    The trueY parameter contains a list of known measurements, with 'nan's for all the other observations.
    For example, for the Kampala data I've picked out all the data which was observed by a low cost sensor
    next to sensor #47:
        from calibration.errormetrics import compute_test_data
        trueY = np.full_like(Y[:,0],np.NaN)
        refkeeps = np.isin(X[:,2],[47])
        trueY[refkeeps] = Y[refkeeps,1]
        refkeeps = np.isin(X[:,1],[47])
        trueY[refkeeps] = Y[refkeeps,0]
        testX, testY, testtrueY = compute_test_data(X,Y,trueY,refsensor)
    
    It constructs the output by considering all the colocations with reference instruments and then
    uess the non-reference instrument as the testY data, and the reference measured values as the trueY values.
    Parameters:
         X = An Nx3 matrix of [time, sensoridA, sensoridB]
         Y = An Nx2 matrix of measured values at sensorA and sensorB.
         trueY = the true pollution at these measurements - if known - otherwise nan.
         refsensor = a binary vector of whether a sensor is a reference sensor or not.
    Returns:
         testX = an Mx3 matrix of [times, sensorid, 0] <-the last column is left in but unused.
         testY = the measured value at the colocated low cost sensor
         testtrueY = the true value of the colocation.
    """
    testX = np.zeros([0,3])
    testY = np.zeros([0,2])
    testtrueY = np.zeros([0,1])
    C = 1
    for flip in [0,1]:
        #flip sensors
        X = np.c_[X[:,0],X[:,2],X[:,1]]
        Y = np.c_[Y[:,1],Y[:,0]]
        keep = ~np.isin(X[:,1],np.where(refsensor)[0]) #X[:,1]>-100
        testX = np.r_[testX, X[keep,:].copy()]
        testX[:,2] = 0
        testtrueY = np.r_[testtrueY,trueY[keep,None]]
        testY = np.r_[testY,Y[keep,:]]
    return testX, testY, testtrueY
