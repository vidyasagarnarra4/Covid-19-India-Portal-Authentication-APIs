const express = require("express");
const app = express();

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
  }
};

initializeDbAndServer();

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My-Secret-token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;
  const userLoginQuery = `
        SELECT
            *
        FROM
            user
        WHERE username = "${username}";
    `;
  const dbUser = await db.get(userLoginQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = await jwt.sign(payload, "My-Secret-token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT
            *
        FROM
            state;
    `;
  const statesArray = await db.all(getStatesQuery);
  const convertedStatesArray = statesArray.map((eachState) => ({
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  }));
  response.send(convertedStatesArray);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getOneStateQuery = `
    SELECT
        *
    FROM
        state
    WHERE
        state_id = ${stateId};
    ;
  `;
  const stateObject = await db.get(getOneStateQuery);
  const convertedStateObject = {
    stateId: stateObject.state_id,
    stateName: stateObject.state_name,
    population: stateObject.population,
  };
  response.send(convertedStateObject);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
        INSERT INTO 
            district(
                district_name,
                state_id,
                cases,
                cured,
                active,
                deaths
            )
        VALUES(
            "${districtName}",
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getOneDistrictQuery = `
        SELECT
            *
        FROM
            district
        WHERE
            district_id = ${districtId};
    `;
    const districtObject = await db.get(getOneDistrictQuery);
    const convertedDistrictObject = {
      districtId: districtObject.district_id,
      districtName: districtObject.district_name,
      stateId: districtObject.state_id,
      cases: districtObject.cases,
      cured: districtObject.cured,
      active: districtObject.active,
      deaths: districtObject.deaths,
    };
    response.send(convertedDistrictObject);
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM
            district
        WHERE
            district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `
        UPDATE
            district
        SET
            district_name = "${districtName}",
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE
            district_id = ${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM 
        district
    WHERE 
        state_id = ${stateId};
    `;
    const stats = await db.get(getStatsQuery);
    response.send(stats);
  }
);

module.exports = app;
