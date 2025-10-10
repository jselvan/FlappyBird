from flask import Flask, render_template, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__, static_folder='static', template_folder='templates')
base_dir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(base_dir, 'leaderboard.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    section = db.Column(db.String(64), nullable=True)
    score = db.Column(db.Integer, nullable=False)
    skin = db.Column(db.String(64), nullable=True, default='Classic')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        # Generate icon URL directly from skin name (skin_name.webp)
        skin_name = self.skin or 'Classic'  # fallback to Classic if skin is None
        icon_url = url_for('static', filename=f'assets/icons/{skin_name}.webp')
        
        return {
            'id': self.id,
            'name': self.name,
            'section': self.section,
            'score': self.score,
            'skin': self.skin,
            'skin_icon_url': icon_url,
            'created_at': self.created_at.isoformat()
        }


@app.before_request
def ensure_db():
    db.create_all()


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/leaderboard')
def leaderboard_page():
    return render_template('leaderboard.html')

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    limit = request.args.get('limit', default=10, type=int)
    section_filter = request.args.get('section')

    query = Score.query
    if section_filter:
        query = query.filter_by(section=section_filter)

    scores = query.order_by(Score.score.desc(), Score.created_at).limit(limit).all()
    return jsonify([s.to_dict() for s in scores])


@app.route('/submit_score', methods=['POST'])
def submit_score():
    data = request.get_json() or {}
    name = data.get('name', 'Anon')[:64]
    section = data.get('section', 'General')[:64]
    skin = data.get('skin', 'Classic')[:64]
    try:
        score_val = int(data.get('score', 0))
    except Exception:
        return jsonify({'error': 'invalid score'}), 400

    s = Score(name=name, section=section, score=score_val, skin=skin)
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
