import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";

const path = "./data.json";
const git = simpleGit();

const TARGET_YEAR = 2025;
const yearStart = moment(`${TARGET_YEAR}-01-01`).startOf("year");

// Source files to capture in the very first commit so the repo keeps its code.
const SOURCE_FILES = [
  "index.js",
  "package.json",
  "package-lock.json",
  "README.md",
  ".gitignore",
  path,
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p) => Math.random() < p;

// Never show more than this many active days back-to-back, so the graph
// always has visible gaps and never looks like one solid green block.
const MAX_STREAK = 18;

// Jan-May: NO fake commits (leave those months to real activity only).
// Jun-Dec: moderate "mid dev" activity that grows slightly month over month.
const monthProfile = (m) => {
  if (m <= 4) {
    // Jan(0) - May(4): skip entirely.
    return null;
  }
  // Jun(5) -> Dec(11): gentle ramp, kept moderate so it reads as
  // "occasionally active" rather than fully green every day.
  const ramp = (m - 5) / 6; // 0 in Jun, 1 in Dec
  return {
    active: 0.28 + ramp * 0.27, // 0.28 -> 0.55 (mostly partial, not full)
    min: 1, // at least 1 commit on an active day
    max: 1 + Math.round(ramp * 2), // 1 -> 3 commits max
    gap: 0.1, // slightly more random breaks for a lighter look
  };
};

const makeCommit = (dayMoment, commitIndex, addFiles) => {
  const date = dayMoment
    .clone()
    .hour(randInt(9, 19))
    .minute(randInt(0, 59))
    .second(commitIndex)
    .format();

  const data = { date };

  return new Promise((resolve, reject) => {
    jsonfile.writeFile(path, data, (err) => {
      if (err) return reject(err);
      git.add(addFiles).commit(date, { "--date": date }, resolve);
    });
  });
};

const run = async () => {
  const cursor = yearStart.clone();
  let totalCommits = 0;
  let firstCommit = true;
  let streak = 0; // consecutive active days so far

  while (cursor.year() === TARGET_YEAR) {
    const prof = monthProfile(cursor.month());

    // Jan-May (null profile): no fake commits at all.
    if (!prof) {
      cursor.add(1, "days");
      streak = 0;
      continue;
    }

    // Hit the streak cap: force a short rest so we never exceed
    // MAX_STREAK active days in a row.
    if (streak >= MAX_STREAK) {
      streak = 0;
      cursor.add(randInt(1, 3), "days");
      continue;
    }

    // small vacation-style gaps in the active half
    if (prof.gap && chance(prof.gap)) {
      streak = 0;
      cursor.add(randInt(2, 5), "days");
      continue;
    }

    const isWeekend = cursor.day() === 0 || cursor.day() === 6;
    const activeChance = isWeekend ? prof.active * 0.4 : prof.active;

    if (chance(activeChance)) {
      const commits = randInt(prof.min, prof.max);
      for (let c = 0; c < commits; c++) {
        const addFiles = firstCommit ? SOURCE_FILES : [path];
        await makeCommit(cursor, c, addFiles);
        firstCommit = false;
        totalCommits++;
      }
      streak++;
    } else {
      // Empty day breaks the streak.
      streak = 0;
    }

    cursor.add(1, "days");
  }

  console.log(`Rebuilt history: ${totalCommits} commits across ${TARGET_YEAR}.`);
};

run();
