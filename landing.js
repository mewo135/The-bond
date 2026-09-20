var flowers = [];
var flowerElements = [];
const FLOWER_COUNT = 5; 
const FLOWER_SPACING = window.innerWidth / (FLOWER_COUNT + 1);

var sparkleColors = ["#dc76a3", "#3c6dbb", "#f9ea93", "#8eba98"];
var mouseParticles = [];
var mouseTrail = [];

const MAX_MOUSE_PARTICLES = 300;
const MAX_MOUSE_TRAIL = 20;

// particle dust
var fairyDust = [];
const DUST_COUNT = 3;

function createFairyDust() {
  if (fairyDust.length < 20) {
    fairyDust.push({
      x: width / 2.1 + random(-445, 445), 
      y: height / 2 + height / 16 + random(-100, 100),
      vx: random(-0.5, 0.5),
      vy: random(-2, -0.5),
      life: 255,
      size: random(1, 2.5)
    });
  }
}

function drawFairyDust() {
  const isDarkMode = document.body.classList.contains('dark');
  const dustColor = isDarkMode ? '#ebe9ff' : '#605889'; 
  
  for (var i = fairyDust.length - 1; i >= 0; i--) {
    var p = fairyDust[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 3;

    fill(dustColor, p.life);
    circle(p.x, p.y, p.size);

    if (p.life <= 0) {
      fairyDust.splice(i, 1);
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
// create flower
  for (var i = 0; i < FLOWER_COUNT; i++) {
    var colorType = Math.random() < 0.5 ? 'pink' : 'yellow';
    var filename = colorType === 'pink' ? 'Hydrangea-pinkpetal.svg' : 'Hydrangea-yellowpetal.svg';
    
    var img = document.createElement('img');
    img.src = 'assets/' + filename;
    img.style.position = 'fixed';
    img.style.left = (FLOWER_SPACING * (i + 1) + (Math.random() - 0.5) * 100) + 'px';
    img.style.top = (Math.random() * 150 - 200) + 'px';
    img.style.width = '48px';
    img.style.height = '48px';
    img.style.pointerEvents = 'none';
    img.style.zIndex = '1';
    document.body.appendChild(img);
    
    flowerElements.push({
      el: img,
      x: parseFloat(img.style.left),
      y: parseFloat(img.style.top),
      speed: Math.random() * 0.5 + 2, 
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 4
    });
  }
}

function draw() {
  clear();
  
  // animate flowers 
  flowerElements.forEach(function(flower) {
    const angle = Math.PI * 115/180;
    flower.y += flower.speed * Math.sin(angle);
    flower.x += flower.speed * Math.cos(angle);
    flower.rotation += flower.rotationSpeed;
    
    flower.el.style.top = flower.y + 'px';
    flower.el.style.left = flower.x + 'px';
    flower.el.style.transform = 'rotate(' + flower.rotation + 'deg)';
    
    var alpha = constrain(map(flower.y, -100, height, 1, 0), 0, 1);
    flower.el.style.opacity = alpha;
    
    if (flower.y > height + 50) {
      flower.y = -100;
      flower.x = Math.random() * window.innerWidth; 
      flower.el.style.left = flower.x + 'px';
      flower.rotation = Math.random() * 360;
    }
  });
  
  MouseEffect();
  createFairyDust();
  drawFairyDust();
}


function MouseEffect() {
  mouseTrail.push({
    x: mouseX,
    y: mouseY
  });

  if (mouseTrail.length > MAX_MOUSE_TRAIL) {
    mouseTrail.shift();
  }

  if (mouseX !== pmouseX || mouseY !== pmouseY) {
    if (mouseParticles.length < MAX_MOUSE_PARTICLES) {
      mouseParticles.push({
        x: mouseX,
        y: mouseY,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 255,
        size: Math.random() * 4 + 2,
        color: sparkleColors[Math.floor(Math.random() * sparkleColors.length)]
      });
    }
  }

  noFill();
  stroke(0, 0);
  beginShape();
  for (var i = 0; i < mouseTrail.length; i++) {
    vertex(mouseTrail[i].x, mouseTrail[i].y);
  }
  endShape();

  noStroke();
  for (var i = mouseParticles.length - 1; i >= 0; i--) {
    var p = mouseParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 4;

    fill(p.color, p.life);
    circle(p.x, p.y, p.size);

    if (p.life <= 0) {
      mouseParticles.splice(i, 1);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('themeToggle');
const titleImg = document.getElementById('titleImg');
const body = document.body;

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
body.classList.add(savedTheme);
themeToggle.checked = savedTheme === 'light';
updateTheme();

themeToggle.addEventListener('change', () => {
  const isLight = themeToggle.checked;
  body.classList.toggle('dark', !isLight);
  body.classList.toggle('light', isLight);
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateTheme();
});

function updateTheme() {
  const isLight = body.classList.contains('light');
  titleImg.src = isLight ? 'assets/title-light.svg' : 'assets/title.svg';
}

// navigation to next stage
document.addEventListener('keydown', (event) => {
  if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
    setTimeout(() => {
      window.location.href = './opening.html';
    }, 800);
  }
});

