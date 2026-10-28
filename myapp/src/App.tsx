import { useState } from "react";
import Papa from "papaparse";
import csvText from "./data.csv?raw"; // Drivers CSV
import resultsText from "./results.csv?raw"; // Race results CSV
import logo from "./logo.svg"; // Logo image file
import "./App.css"; // Use our style file

// ---------- 1. A class that matches one driver ----------
class Driver {
  id!: string;
  ref!: string;
  number!: string;
  code!: string;
  fullName!: string;
  dob!: string;
  birthYear!: number; // 0 means "unknown"
  nationality!: string;
  url!: string;
  // Career stats (filled in from results.csv)
  races: number = 0;
  wins: number = 0;
  podiums: number = 0;
  poles: number = 0;
  fastestLaps: number = 0;
  points: number = 0;

  get winRate(): number {
    return this.races === 0 ? 0 : Math.round((this.wins / this.races) * 1000) / 10;
  }
}

// The CSV uses \N for "no value". Turn it into an empty string.
function clean(value: string): string {
  return value === "\\N" ? "" : value;
}

// Show a dash when a text/year value is empty
function show(value: string | number): string {
  return value === "" || value === 0 ? "—" : String(value);
}

// ---------- 2. Read drivers.csv into Driver objects ----------
const driverRows: any[] = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
}).data;

const drivers: Driver[] = [];
const byId: { [id: string]: Driver } = {}; // quick lookup by driverId

for (let loop: number = 0; loop < driverRows.length; loop++) {
  const row = driverRows[loop];
  const driver = new Driver();
  driver.id = row.driverId;
  driver.ref = row.driverRef;
  driver.number = clean(row.number);
  driver.code = clean(row.code);
  driver.fullName = row.forename + " " + row.surname;
  driver.dob = clean(row.dob);
  driver.birthYear = driver.dob === "" ? 0 : Number(driver.dob.slice(0, 4));
  driver.nationality = clean(row.nationality);
  driver.url = clean(row.url);
  drivers.push(driver);
  byId[driver.id] = driver;
}

// ---------- 3. Read results.csv and add up each driver's stats ----------
const resultRows: any[] = Papa.parse(resultsText, {
  header: true,
  skipEmptyLines: true,
}).data;

for (let loop: number = 0; loop < resultRows.length; loop++) {
  const row = resultRows[loop];
  const driver = byId[row.driverId];
  if (!driver) {
    continue; // skip results for unknown drivers
  }
  const finish = Number(row.position); // \N (did not finish) becomes NaN
  driver.races = driver.races + 1;
  if (finish === 1) driver.wins = driver.wins + 1;
  if (finish >= 1 && finish <= 3) driver.podiums = driver.podiums + 1;
  if (Number(row.grid) === 1) driver.poles = driver.poles + 1;
  if (Number(row.rank) === 1) driver.fastestLaps = driver.fastestLaps + 1;
  driver.points = driver.points + (Number(row.points) || 0);
}

// ---------- 4. Build dropdown lists from the data ----------
const nationalities: string[] = [];
const decades: number[] = [];
for (let loop: number = 0; loop < drivers.length; loop++) {
  const d = drivers[loop];
  if (d.nationality !== "" && !nationalities.includes(d.nationality)) {
    nationalities.push(d.nationality);
  }
  if (d.birthYear > 0) {
    const decade = Math.floor(d.birthYear / 10) * 10;
    if (!decades.includes(decade)) {
      decades.push(decade);
    }
  }
}
nationalities.sort();
decades.sort();

const MAX_ROWS: number = 100; // Keep the page fast

// ---------- 5. A searchable driver picker (a reusable component) ----------
function DriverPicker(props: {
  label: string;
  selected: Driver | undefined;
  onSelect: (driver: Driver) => void;
}) {
  const [text, setText] = useState<string>(
    props.selected ? props.selected.fullName : ""
  );
  const [open, setOpen] = useState<boolean>(false);

  // Suggestions: names that contain the text, most race wins first
  const suggestions = drivers
    .filter(
      (d) =>
        text === "" ||
        text === (props.selected ? props.selected.fullName : "") ||
        d.fullName.toLowerCase().includes(text.toLowerCase())
    )
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 8);

  function choose(driver: Driver) {
    props.onSelect(driver);
    setText(driver.fullName);
    setOpen(false);
  }

  return (
    <div className="picker">
      <label>{props.label}</label>
      <input
        type="text"
        placeholder="Type a driver name..."
        value={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <ul className="suggestions">
          {suggestions.length === 0 && <li>No drivers found</li>}
          {suggestions.map((d) => (
            <li key={d.id} onMouseDown={() => choose(d)}>
              {d.fullName} <span>({d.wins} wins)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function App() {
  // ---------- State: things the user can change ----------
  const [search, setSearch] = useState<string>("");
  const [nationality, setNationality] = useState<string>("All");
  const [decade, setDecade] = useState<string>("All");
  const [modernOnly, setModernOnly] = useState<boolean>(false);
  const [winnersOnly, setWinnersOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("wins");
  const [refA, setRefA] = useState<string>("hamilton");
  const [refB, setRefB] = useState<string>("senna");

  // ---------- Search + filter ----------
  const matches = drivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(search.toLowerCase()) &&
      (nationality === "All" || d.nationality === nationality) &&
      (decade === "All" ||
        (d.birthYear > 0 &&
          Math.floor(d.birthYear / 10) * 10 === Number(decade))) &&
      (!modernOnly || d.code !== "") &&
      (!winnersOnly || d.wins > 0)
  );

  // ---------- Sort ----------
  const sorted = [...matches].sort((a, b) => {
    if (sortBy === "wins") return b.wins - a.wins;
    if (sortBy === "podiums") return b.podiums - a.podiums;
    if (sortBy === "points") return b.points - a.points;
    if (sortBy === "races") return b.races - a.races;
    if (sortBy === "youngest") return b.birthYear - a.birthYear;
    if (sortBy === "oldest") {
      // drivers with an unknown birth year (0) go last
      return (a.birthYear || 9999) - (b.birthYear || 9999);
    }
    return a.fullName.localeCompare(b.fullName);
  });
  const shown = sorted.slice(0, MAX_ROWS);

  function resetFilters() {
    setSearch("");
    setNationality("All");
    setDecade("All");
    setModernOnly(false);
    setWinnersOnly(false);
    setSortBy("wins");
  }

  // ---------- The debate ----------
  const driverA = drivers.find((d) => d.ref === refA);
  const driverB = drivers.find((d) => d.ref === refB);

  const rows =
    driverA && driverB
      ? [
          { label: "Races", a: driverA.races, b: driverB.races, score: false },
          { label: "Wins", a: driverA.wins, b: driverB.wins, score: true },
          { label: "Podiums", a: driverA.podiums, b: driverB.podiums, score: true },
          { label: "Pole positions", a: driverA.poles, b: driverB.poles, score: true },
          { label: "Fastest laps", a: driverA.fastestLaps, b: driverB.fastestLaps, score: true },
          { label: "Career points", a: driverA.points, b: driverB.points, score: true },
          { label: "Win rate (%)", a: driverA.winRate, b: driverB.winRate, score: true },
        ]
      : [];
  const scoreA = rows.filter((r) => r.score && r.a > r.b).length;
  const scoreB = rows.filter((r) => r.score && r.b > r.a).length;

  let verdict = "";
  if (driverA && driverB) {
    if (scoreA > scoreB) {
      verdict = driverA.fullName + " leads in " + scoreA + " of 6 categories.";
    } else if (scoreB > scoreA) {
      verdict = driverB.fullName + " leads in " + scoreB + " of 6 categories.";
    } else {
      verdict = "It's a tie: " + scoreA + " categories each.";
    }
  }

  return (
    <div>
      <div>
        <img src={logo} style={{ width: "200px", height: "100px" }} />
        <p>Settle the debate: compare any F1 drivers in history.</p>
      </div>

      {/* ---------- Head to head ---------- */}
      <h2>Head to head</h2>
      <div className="panel versus">
        <DriverPicker
          label="Driver A"
          selected={driverA}
          onSelect={(d) => setRefA(d.ref)}
        />
        <DriverPicker
          label="Driver B"
          selected={driverB}
          onSelect={(d) => setRefB(d.ref)}
        />
      </div>

      {driverA && driverB && (
        <div>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>{driverA.fullName}</th>
                <th>{driverB.fullName}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Nationality</td>
                <td>{show(driverA.nationality)}</td>
                <td>{show(driverB.nationality)}</td>
              </tr>
              <tr>
                <td>Born</td>
                <td>{show(driverA.dob)}</td>
                <td>{show(driverB.dob)}</td>
              </tr>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className={r.score && r.a > r.b ? "better" : ""}>{r.a}</td>
                  <td className={r.score && r.b > r.a ? "better" : ""}>{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="verdict">{verdict}</p>
          <p className="note">
            Gold marks the leader in each row. Points are not fair across eras
            because F1 has changed its points system over the years.
          </p>
        </div>
      )}

      {/* ---------- Search and filters ---------- */}
      <h2>Find a driver</h2>
      <div className="panel">
        <div>
          <label htmlFor="search">Search name: </label>
          <input
            id="search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="nationality">Nationality: </label>
          <select
            id="nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          >
            <option>All</option>
            {nationalities.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <label htmlFor="decade">Born in: </label>
          <select
            id="decade"
            value={decade}
            onChange={(e) => setDecade(e.target.value)}
          >
            <option value="All">All</option>
            {decades.map((dc) => (
              <option key={dc} value={dc}>
                {dc}s
              </option>
            ))}
          </select>
          <label htmlFor="sortBy">Sort by: </label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="wins">Most wins</option>
            <option value="podiums">Most podiums</option>
            <option value="points">Most points</option>
            <option value="races">Most races</option>
            <option value="youngest">Youngest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={winnersOnly}
              onChange={(e) => setWinnersOnly(e.target.checked)}
            />{" "}
            Race winners only
          </label>
          <label>
            <input
              type="checkbox"
              checked={modernOnly}
              onChange={(e) => setModernOnly(e.target.checked)}
            />{" "}
            Modern drivers only (have a 3-letter code)
          </label>
        </div>
        <div>
          <button type="button" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <p>
        <label>Matching drivers: </label>
        {matches.length} of {drivers.length}
        {matches.length > MAX_ROWS && " (showing the first " + MAX_ROWS + ")"}
      </p>

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Nationality</th>
            <th>Born</th>
            <th>Races</th>
            <th>Wins</th>
            <th>Podiums</th>
            <th>Poles</th>
            <th>Points</th>
            <th>Wikipedia</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((d) => (
            <tr key={d.id}>
              <td>{d.fullName}</td>
              <td>{show(d.nationality)}</td>
              <td>{show(d.birthYear)}</td>
              <td>{d.races}</td>
              <td>{d.wins}</td>
              <td>{d.podiums}</td>
              <td>{d.poles}</td>
              <td>{d.points}</td>
              <td>
                {d.url !== "" ? (
                  <a href={d.url} target="_blank" rel="noreferrer">
                    Read
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {matches.length === 0 && <p>No drivers match. Try Reset.</p>}
    </div>
  );
}

export default App;
