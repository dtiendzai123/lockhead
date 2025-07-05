// === CONFIG ĐỘ NHẠY ===
const sensitivityConfig = {
  yaw: 0.52,
  pitch: 0.49
};

// === APPLY BINDPOSE ===
function applyBindposeTransform(pos, bindpose) {
  const x = pos.x, y = pos.y, z = pos.z;
  return {
    x: bindpose.e00 * x + bindpose.e01 * y + bindpose.e02 * z + bindpose.e03,
    y: bindpose.e10 * x + bindpose.e11 * y + bindpose.e12 * z + bindpose.e13,
    z: bindpose.e20 * x + bindpose.e21 * y + bindpose.e22 * z + bindpose.e23
  };
}

// === TỰ LOCK TÂM NGẮM VÀO BONE HEAD ===
function lockCrosshairToBoneHead(camera, enemy) {
  const rawHeadPos = enemy.head;
  const transformedHead = applyBindposeTransform(rawHeadPos, enemy.bindpose);

  const dx = transformedHead.x - camera.position.x;
  const dy = transformedHead.y - camera.position.y;
  const dz = transformedHead.z - camera.position.z;

  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const dir = { x: dx / len, y: dy / len, z: dz / len };

  const pitch = -Math.asin(dir.y);
  const yaw = Math.atan2(dir.x, dir.z);

  sendInputToMouse({
    deltaX: yaw * sensitivityConfig.yaw,
    deltaY: pitch * sensitivityConfig.pitch
  });

  console.log(`🔒 Locked → Head | Yaw: ${yaw.toFixed(3)} | Pitch: ${pitch.toFixed(3)}`);
}

// === DRAG + SNAP CỰC MẠNH VÀO ĐẦU ===
function adjustAimAfterPull(currentPos, targetHeadPos, armorZonePos, pullDistance, boneInfo = {}) {
  // Offset từ bindpose nếu có
  if (boneInfo.offset) {
    targetHeadPos = {
      x: targetHeadPos.x + boneInfo.offset.x,
      y: targetHeadPos.y + boneInfo.offset.y
    };
  }

  const distToHead = Math.hypot(currentPos.x - targetHeadPos.x, currentPos.y - targetHeadPos.y);
  const distToArmor = Math.hypot(currentPos.x - armorZonePos.x, currentPos.y - armorZonePos.y);

  // Kéo nhẹ về giáp nếu gần hơn
  if (distToArmor < distToHead * 0.7) {
    currentPos.x += (armorZonePos.x - currentPos.x) * 0.3;
    currentPos.y += (armorZonePos.y - currentPos.y) * 0.3;
  }

  // Kéo mượt bằng easing về đầu
  const t = Math.min(1, pullDistance / 50);
  const easeOutQuad = (x) => 1 - (1 - x) * (1 - x);
  const easeFactor = easeOutQuad(t);
  currentPos.x += (targetHeadPos.x - currentPos.x) * easeFactor * 0.6;
  currentPos.y += (targetHeadPos.y - currentPos.y) * easeFactor * 0.6;

  // Snap cực mạnh nếu gần vào vùng đầu
  const headRadius = boneInfo.radius || 6.5;
  const distToBone = Math.hypot(currentPos.x - targetHeadPos.x, currentPos.y - targetHeadPos.y);

  if (distToBone < headRadius) {
    const pullFactor = (headRadius - distToBone) / headRadius;
    currentPos.x += (targetHeadPos.x - currentPos.x) * pullFactor * 0.85;
    currentPos.y += (targetHeadPos.y - currentPos.y) * pullFactor * 0.85;
  }

  return currentPos;
}

// === DEMO DÙNG THỬ ===
function simulateHeadLocking() {
  const camera = {
    position: { x: 0, y: 1.7, z: 0 }
  };

  const enemy = {
    head: {
      x: -0.0456970781,
      y: -0.004478302,
      z: -0.0200432576
    },
    bindpose: {
      e00: -1.34559613E-13, e01: 8.881784E-14, e02: -1.0, e03: 0.487912,
      e10: -2.84512817E-06, e11: -1.0, e12: 8.881784E-14, e13: -2.842171E-14,
      e20: -1.0, e21: 2.84512817E-06, e22: -1.72951931E-13, e23: 0.0,
      e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
    }
  };

  const armorZone = { x: 0.1, y: 0.1 };
  const currentCrosshair = { x: 0.0, y: 0.0 };
  const pullDistance = 15;

  const pulledAim = adjustAimAfterPull(currentCrosshair, enemy.head, armorZone, pullDistance, {
    offset: { x: 0.002, y: 0.004 },
    radius: 7.0
  });

  console.log("🎯 Adjusted Aim Pos:", pulledAim);

  lockCrosshairToBoneHead(camera, enemy);
}

// === MOCK INPUT MOUSE ===
function sendInputToMouse({ deltaX, deltaY }) {
  console.log(`🖱️ Move Mouse → ΔX=${deltaX.toFixed(3)} | ΔY=${deltaY.toFixed(3)}`);
}

// === CHẠY DEMO ===
simulateHeadLocking();
