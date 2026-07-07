const NAME_ADJECTIVES = [
  "Curious",
  "Bright",
  "Swift",
  "Gentle",
  "Bold",
  "Calm",
  "Eager",
  "Jolly",
  "Kind",
  "Lively",
  "Nimble",
  "Proud",
  "Sunny",
  "Vivid",
  "Witty",
];

const NAME_ANIMALS = [
  "Falcon",
  "Otter",
  "Panda",
  "Heron",
  "Tiger",
  "Sparrow",
  "Dolphin",
  "Lynx",
  "Koala",
  "Fox",
  "Rabbit",
  "Owl",
  "Badger",
  "Crane",
  "Gecko",
];

const AVATAR_ICONS = [
  "🦊",
  "🦦",
  "🐼",
  "🦉",
  "🐯",
  "🐬",
  "🐨",
  "🦅",
  "🐰",
  "🦆",
  "🦡",
  "🐢",
];

function generateGuestIdentity() {
  const adjective =
    NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const animal = NAME_ANIMALS[Math.floor(Math.random() * NAME_ANIMALS.length)];
  const suffix = Math.floor(Math.random() * 900 + 100);
  const avatarIcon =
    AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];

  return {
    displayName: `${adjective} ${animal} ${suffix}`,
    avatarIcon,
  };
}

module.exports = { generateGuestIdentity };
