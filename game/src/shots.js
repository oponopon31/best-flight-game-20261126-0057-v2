// Screenshot staging for AERIS — Ridge Run.
// ?shot=start|play|rings|landing&seed=1 puts the game at a good, fixed
// moment with a seeded world. These are real renders of the game's own code.
import * as THREE from 'three';

export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: Number(q.get('seed') || '1') || 1,
    mission: q.get('mission') || 'rings',
    unlock: q.get('unlock') || null,
  };
}

// Stage the flight state + mission for one named shot. Returns the state
// the game should start in ('title' shows the title screen over the scene).
export function stageShot(shot, state, missions, terrain) {
  const S = state;
  const groundAt = (x, z) => terrain.heightAt(x, z);
  switch (shot) {
    case 'start': {
      // On the home runway, engine idling, title screen over the scene.
      S.position.set(0, 5.6, 900);
      S.heading = 0;
      S.pitch = 0;
      S.roll = 0;
      S.speed = 0;
      S.throttle = 0.22;
      S.fuel = 100;
      S.damage = 0;
      S.onGround = true;
      S.shotCamX = 7; // chase camera sits right so the plane shows left of the title card
      missions.start('rings');
      missions.timeLeft = 240;
      return 'title';
    }
    case 'play': {
      // Mid-flight chase view: a glowing ring ahead, valley and river below.
      // Close enough that the green ring reads big in frame.
      S.position.set(60, 78, 200);
      S.heading = -0.2;
      S.pitch = -0.02;
      S.roll = 0.0;
      S.speed = 58;
      S.throttle = 0.72;
      S.fuel = 78;
      S.damage = 0;
      S.onGround = false;
      missions.start('rings');
      missions.timeLeft = 186;
      missions.score = 2400;
      // Pretend two rings are already passed so the next ring is the green one ahead.
      missions.targets[0].passed = true;
      missions.targets[1].passed = true;
      missions.nextIndex = 2;
      missions.updateRingColours();
      return 'playing';
    }
    case 'cockpit': {
      // Cockpit view mid-flight: lit gauges on the panel, the next green
      // ring dead ahead through the nose, valley and river below.
      S.position.set(60, 78, 200);
      S.heading = -0.2;
      S.pitch = -0.02;
      S.roll = 0.0;
      S.speed = 58;
      S.throttle = 0.72;
      S.fuel = 78;
      S.damage = 0;
      S.onGround = false;
      S.cockpitView = true;
      missions.start('rings');
      missions.timeLeft = 186;
      missions.score = 2400;
      missions.targets[0].passed = true;
      missions.targets[1].passed = true;
      missions.nextIndex = 2;
      missions.updateRingColours();
      return 'playing';
    }
    case 'dusk': {
      // Dusk final approach to the HOME runway: lit threshold, approach
      // lights and PAPI ahead, orange sky, rings already half flown.
      S.position.set(8, 42, 1290);
      S.heading = 0.0;
      S.pitch = -0.03;
      S.roll = 0.0;
      S.speed = 42;
      S.throttle = 0.5;
      S.fuel = 55;
      S.damage = 0;
      S.onGround = false;
      missions.start('dusk');
      missions.timeLeft = 150;
      missions.score = 3100;
      for (let i = 0; i < 3; i++) missions.targets[i].passed = true;
      missions.nextIndex = 3;
      missions.updateRingColours();
      return 'playing';
    }
    case 'rings': {
      // Low pass through the canyon: a ring dead ahead, ridges on both sides.
      // Straight down the valley (heading 0) so the plane never drifts into a wall.
      S.position.set(60, 85, -260);
      S.heading = 0.0;
      S.pitch = 0.0;
      S.roll = 0.0;
      S.speed = 66;
      S.throttle = 0.85;
      S.fuel = 61;
      S.damage = 0;
      S.onGround = false;
      missions.start('rings');
      missions.timeLeft = 132;
      missions.score = 5300;
      for (let i = 0; i < 4; i++) missions.targets[i].passed = true;
      missions.nextIndex = 4;
      missions.updateRingColours();
      return 'playing';
    }
    case 'landing': {
      // Final approach to the FAR strip, ON its extended centreline
      // (x = -140 + 0.1206 * (z + 1150)): runway ahead, gear down, low and slow.
      // Close enough that the strip reads big and centred; the last
      // checkpoint ring sits ~65 deg off-axis to the right, out of frame.
      S.position.set(-107, 38, -880);
      S.heading = 0.12;
      S.pitch = -0.04;
      S.roll = 0.02;
      S.speed = 40;
      S.throttle = 0.45;
      S.fuel = 44;
      S.damage = 0;
      S.onGround = false;
      missions.start('delivery');
      missions.timeLeft = 96;
      missions.score = 8100;
      for (let i = 0; i < 4; i++) missions.targets[i].passed = true;
      missions.nextIndex = 4;
      missions.updateRingColours();
      missions.message = 'LAND ON THE FAR STRIP';
      return 'playing';
    }
    default:
      return 'title';
  }
}
