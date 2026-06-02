from flask import Flask, render_template, request, session
from auth import auth_bp

# from model import model

app = Flask(__name__)
app.config['SECRETE_KEY'] = "12345567"


app.register_blueprint(auth_bp)


@app.route("/")
def base():
    return render_template("base.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
