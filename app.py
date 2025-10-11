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
    
    # Join back to get the full record with the highest score for each name/section
    scores = db.session.query(Score).join(
        max_scores,
        (Score.name == max_scores.c.name) & 
        (Score.section == max_scores.c.section) & 
        (Score.score == max_scores.c.max_score)
    ).order_by(Score.score.desc(), Score.created_at).limit(limit).all()
    
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
