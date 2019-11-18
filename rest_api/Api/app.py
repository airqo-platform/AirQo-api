from flask import Flask,render_template,url_for,request
from predict import make_prediction
app = Flask(__name__)

@app.route('/')
def Home():
    return render_template("home.html")

@app.route('/predict',methods =['POST'])
def predict():
    if request.method == 'POST':
        channel = request.form['channel']
        date_time = request.form['date_time']

        result = make_prediction(channel,date_time)
        
    return render_template("result.html",prediction =result)

if __name__ =="__main__":
    app.run(debug =True)
