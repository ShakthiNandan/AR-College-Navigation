from flask import Flask, jsonify, send_from_directory, send_file
import os
import json

app = Flask(__name__, static_folder='static')

# Serve scenes.json
@app.route('/scenes')
def get_scenes():
    with open('scenes.json', 'r') as f:
        return jsonify(json.load(f))

# Serve the main page
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/models/<model_name>')
def get_model(model_name):
    model_path = os.path.join('static', 'models', model_name)
    return send_file(model_path)

if __name__ == '__main__':
    app.run(debug=True, ssl_context='adhoc',host='0.0.0.0', port=5000)  # SSL is required for WebXR