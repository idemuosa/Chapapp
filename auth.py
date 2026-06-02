from flask import Blueprint
from flask import session, render_template, request, redirect, flash
# from extension import db
# from werkzeug.security import generate_password_hash, check_password_hash


# # from service import send_email
# from model import User
# from flask_login import login_user, login_required, logout_user

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/")
def admin():
    return render_template("admin.html")