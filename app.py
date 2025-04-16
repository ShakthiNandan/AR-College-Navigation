from flask import Flask, render_template, send_file, jsonify
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scenes')
def get_scenes():
    with open('scenes.json', 'r') as f:
        return send_file('scenes.json', mimetype='application/json')

@app.route('/models/<model_name>')
def get_model(model_name):
    model_path = os.path.join('static', 'models', model_name)
    return send_file(model_path)

if __name__ == '__main__':
    app.run(debug=True, ssl_context='adhoc',host='0.0.0.0', port=5000)  # SSL is required for WebXR