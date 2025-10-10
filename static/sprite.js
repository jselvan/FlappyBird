function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

const ALL_SKINS = {
  "Classic": {
    name: "Classic",
    body: "/static/assets/skins/classic_body.png",
    frontWing: "/static/assets/skins/front_wing.png",   // shared placeholder
    backWing: "/static/assets/skins/back_wing.png"     // shared placeholder
  },
  "24k": {
    name: "24 Karat Sniffy",
    body: "/static/assets/skins/24k_body.png",
    frontWing: "/static/assets/skins/24k_front_wing.png",
    backWing: "/static/assets/skins/24k_back_wing.png"
  }
};

const skinImages = {};

for (let key in ALL_SKINS) {
  const skin = ALL_SKINS[key];
  skinImages[key] = {
    body: new Image(),
    frontWing: new Image(),
    backWing: new Image()
  };
  skinImages[key].body.src = skin.body;
  skinImages[key].frontWing.src = skin.frontWing;
  skinImages[key].backWing.src = skin.backWing;
}
let currentSkin = localStorage.getItem('currentSkin') || 'Classic';

class Bird {
    constructor(x, y, size, skin) {
        this.x = x;
        this.y = y;
        this.vy = 0; // vertical velocity
        this.size = size;
        this.halfSize = size / 2;
        this.skin = skin;
        this.wing = {
            angle: 0,
            velocity: 0,
            maxRot: 0.5, // ~30 degrees
            restAngle: 0, // wings rest at 0 radians
            damping: 0.15, // how quickly velocity decays
            returnSpeed: 0.08 // how quickly angle returns to rest
        }
        this.padding = {
            top: 16,
            bottom: 4,
            side: 10
        }
    }
    update(dt) {
        this.vy += 0.25 * dt; // gravity
        this.y += this.vy * dt;

        // Update wing angle based on velocity
        this.wing.angle += this.wing.velocity * dt;
        // Decay velocity toward 0
        this.wing.velocity *= (1 - this.wing.damping * dt);
        // Gently pull wing angle toward rest angle
        this.wing.angle += (this.wing.restAngle - this.wing.angle) * this.wing.returnSpeed;
        // Clamp to max rotation limits
        this.wing.angle = clamp(this.wing.angle, -this.wing.maxRot, this.wing.maxRot);
    }
    draw(ctx) {
        const bodyImg = this.skin.body;
        const frontWingImg = this.skin.frontWing;
        const backWingImg = this.skin.backWing;

        const bx = this.x - this.halfSize;
        const by = this.y - this.halfSize;

        // --- Back wing ---
        if (backWingImg && backWingImg.complete) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.wing.angle);
            ctx.drawImage(backWingImg, - this.halfSize, - this.halfSize, this.size, this.size);
            ctx.restore();
        }
        // --- Body ---
        if (bodyImg && bodyImg.complete) {
            ctx.drawImage(bodyImg, bx, by, this.size, this.size);
        }
        // --- Front wing ---
        if (frontWingImg && frontWingImg.complete) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.wing.angle);
            ctx.drawImage(frontWingImg, - this.halfSize, - this.halfSize, this.size, this.size);
            ctx.restore();
        }
    }
    getBounds() {
        return {
            left: this.x - this.halfSize + this.padding.side,
            right: this.x + this.halfSize - this.padding.side,
            top: this.y - this.halfSize + this.padding.top,
            bottom: this.y + this.halfSize - this.padding.bottom
        };
    }
}
