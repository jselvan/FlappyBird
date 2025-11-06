from flask import Flask, render_template, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import re
import unicodedata
import random

# Load environment variables from a .env file (if present)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    # Silently continue if python-dotenv is not installed
    pass

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
    near_misses = db.Column(db.Integer, nullable=False, default=0)
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
            'near_misses': self.near_misses,
            'created_at': self.created_at.isoformat()
        }


# --- Minor profanity filter helpers ---
# Note: keep this list small and school-safe; extend via environment if needed.
BASIC_PROFANITY = set(
    (os.environ.get("EXTRA_PROFANITY", "")
        .lower()
        .split(",") if os.environ.get("EXTRA_PROFANITY") else [])
)

# You can seed a minimal default list without explicit examples here if desired.
# For demonstration, we keep it empty by default to avoid false positives.

LEET_MAP = str.maketrans({
    '0': 'o',
    '1': 'i',  # could be 'l' as well; choose one to avoid over-flagging
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '8': 'b',
})

def _normalize_for_match(s: str) -> str:
    s = s.lower().translate(LEET_MAP)
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    # keep letters only to catch spaced/punctuated variants
    s = re.sub(r'[^a-z]', '', s)
    # collapse repeats (e.g., cooool -> cool)
    s = re.sub(r'(.)\1{2,}', r'\1\1', s)
    return s

def _fallback_player_name() -> str:
    # Create a short random numeric suffix for uniqueness, e.g., Player-4821
    return f"Player-{random.randint(1000, 9999)}"

def sanitize_name(name: str) -> str:
    try:
        norm = _normalize_for_match(name)
        if any(word and word in norm for word in BASIC_PROFANITY):
            return _fallback_player_name()
        # fallback names if empty or whitespace
        if not name or not name.strip():
            return _fallback_player_name()
        return name
    except Exception:
        return _fallback_player_name()


@app.before_request
def ensure_db():
    db.create_all()
    # Minimal migration: add near_misses column if it doesn't exist
    try:
        insp = db.inspect(db.engine)
        cols = [c['name'] for c in insp.get_columns('score')]
        if 'near_misses' not in cols:
            with db.engine.connect() as conn:
                conn.execute(db.text('ALTER TABLE score ADD COLUMN near_misses INTEGER NOT NULL DEFAULT 0'))
    except Exception:
        # Best-effort; ignore if table doesn't exist yet or already updated
        pass


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

    # Get unique name/section combinations with their highest scores
    from sqlalchemy import func
    
    # Subquery to find the maximum score for each name/section combination
    max_scores = db.session.query(
        Score.name,
        Score.section,
        func.max(Score.score).label('max_score')
    )
    
    if section_filter:
        max_scores = max_scores.filter(Score.section == section_filter)
    
    max_scores = max_scores.group_by(Score.name, Score.section).subquery()
    # For players who achieved their max score multiple times, select the most recent occurrence
    best_rows = db.session.query(
        Score.name.label('name'),
        Score.section.label('section'),
        func.max(Score.created_at).label('max_created_at')
    ).join(
        max_scores,
        (Score.name == max_scores.c.name) &
        (Score.section == max_scores.c.section) &
        (Score.score == max_scores.c.max_score)
    ).group_by(Score.name, Score.section).subquery()

    # Join back to get exactly one row per player/section: their highest score and latest timestamp for that score
    scores = db.session.query(Score).join(
        max_scores,
        (Score.name == max_scores.c.name) &
        (Score.section == max_scores.c.section) &
        (Score.score == max_scores.c.max_score)
    ).join(
        best_rows,
        (Score.name == best_rows.c.name) &
        (Score.section == best_rows.c.section) &
        (Score.created_at == best_rows.c.max_created_at)
    ).order_by(Score.score.desc(), Score.created_at).limit(limit).all()
    
    return jsonify([s.to_dict() for s in scores])


@app.route('/submit_score', methods=['POST'])
def submit_score():
    data = request.get_json() or {}
    name_raw = data.get('name', 'Anon')[:64]
    name = sanitize_name(name_raw)[:64]
    section = data.get('section', 'General')[:64]
    skin = data.get('skin', 'Classic')[:64]
    near_misses = data.get('nearMisses') or data.get('NearMisses') or 0
    try:
        score_val = int(data.get('score', 0))
    except Exception:
        return jsonify({'error': 'invalid score'}), 400
    try:
        near_misses = int(near_misses)
    except Exception:
        near_misses = 0

    s = Score(name=name, section=section, score=score_val, skin=skin, near_misses=near_misses)
    db.session.add(s)
    db.session.commit()
    
    # Check rankings using unique name/section combinations
    from sqlalchemy import func
    
    # Overall top 5 check - unique players only
    max_scores_overall = db.session.query(
        Score.name,
        Score.section,
        func.max(Score.score).label('max_score')
    ).group_by(Score.name, Score.section).subquery()
    
    overall_top5 = db.session.query(Score).join(
        max_scores_overall,
        (Score.name == max_scores_overall.c.name) & 
        (Score.section == max_scores_overall.c.section) & 
        (Score.score == max_scores_overall.c.max_score)
    ).order_by(Score.score.desc()).limit(5).all()
    
    # Only celebrate if the current score being submitted would achieve the ranking
    # Get what the new leaderboard would look like with this score included
    
    # Create temporary updated leaderboard for overall rankings
    temp_overall_scores = []
    current_player_found = False
    
    # Add/update current player's score in the overall ranking
    for score_record in overall_top5:
        if score_record.name == name and score_record.section == section:
            # Replace with current score if it's higher, otherwise keep existing
            if score_val > score_record.score:
                temp_overall_scores.append({'name': name, 'section': section, 'score': score_val})
            else:
                temp_overall_scores.append({'name': score_record.name, 'section': score_record.section, 'score': score_record.score})
            current_player_found = True
        else:
            temp_overall_scores.append({'name': score_record.name, 'section': score_record.section, 'score': score_record.score})
    
    # If player not in top 5, add them
    if not current_player_found:
        temp_overall_scores.append({'name': name, 'section': section, 'score': score_val})
    
    # Sort by score and take top 5
    temp_overall_scores.sort(key=lambda x: x['score'], reverse=True)
    temp_overall_top5 = temp_overall_scores[:5]
    
    # Check if current player with current score is in top 5/top 1
    is_overall_top5 = any(p['name'] == name and p['section'] == section and p['score'] == score_val for p in temp_overall_top5)
    is_overall_best = len(temp_overall_top5) > 0 and temp_overall_top5[0]['name'] == name and temp_overall_top5[0]['section'] == section and temp_overall_top5[0]['score'] == score_val
    
    # Section top 5 check - same logic for section
    max_scores_section = db.session.query(
        Score.name,
        Score.section,
        func.max(Score.score).label('max_score')
    ).filter(Score.section == section).group_by(Score.name, Score.section).subquery()
    
    section_top5 = db.session.query(Score).join(
        max_scores_section,
        (Score.name == max_scores_section.c.name) & 
        (Score.section == max_scores_section.c.section) & 
        (Score.score == max_scores_section.c.max_score)
    ).order_by(Score.score.desc()).limit(5).all()
    
    # Create temporary updated leaderboard for section rankings
    temp_section_scores = []
    current_player_found_section = False
    
    for score_record in section_top5:
        if score_record.name == name and score_record.section == section:
            if score_val > score_record.score:
                temp_section_scores.append({'name': name, 'section': section, 'score': score_val})
            else:
                temp_section_scores.append({'name': score_record.name, 'section': score_record.section, 'score': score_record.score})
            current_player_found_section = True
        else:
            temp_section_scores.append({'name': score_record.name, 'section': score_record.section, 'score': score_record.score})
    
    if not current_player_found_section:
        temp_section_scores.append({'name': name, 'section': section, 'score': score_val})
    
    temp_section_scores.sort(key=lambda x: x['score'], reverse=True)
    temp_section_top5 = temp_section_scores[:5]
    
    is_section_top5 = any(p['name'] == name and p['section'] == section and p['score'] == score_val for p in temp_section_top5)
    
    response_data = s.to_dict()
    response_data['is_overall_top5'] = is_overall_top5
    response_data['is_overall_best'] = is_overall_best
    response_data['is_section_top5'] = is_section_top5
    
    return jsonify(response_data), 201


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
