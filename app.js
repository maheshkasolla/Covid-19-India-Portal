const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

/// API 1

/// Path: `/login/`

/// Method: `POST`

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  // check user
  const userDetailsQuery = `select * from user where username = '${username}';`;
  const userDetails = await db.get(userDetailsQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user"); //Scenario 1
  } else {
    const isPasswordValid = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordValid) {
      //get JWT Token
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "mahesh_secret_key");
      response.send({ jwtToken });
      console.log(jwtToken); //Scenario 3
    } else {
      response.status(400);
      response.send(`Invalid password`); //Scenario 2
    }
  }
});

///access token verify

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "mahesh_secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`); // Scenario 1
      } else {
        next(); //Scenario 2
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`); //Scenario 1
  }
}
///API 2
const returnAllStates = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};

app.get("/states/", authenticationToken, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state`;
  const dbResponse = await db.all(getAllStatesQuery);
  response.send(dbResponse.map((eachState) => returnAllStates(eachState)));
});

///API3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getSingleState = `SELECT * FROM state WHERE state_id=${stateId}`;
  const dbResponse = await db.get(getSingleState);
  response.send(returnAllStates(dbResponse));
});
///API4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const AddDistricts = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths})`;
  const dbResponse = await db.run(AddDistricts);
  const lastId = dbResponse.lastID;
  response.send(`District Successfully Added`);
});

/// API 5

///Path: `/districts/:districtId/`

///Method: `GET`
const returnDistrict = (item) => {
  return {
    districtId: item.district_id,
    districtName: item.district_name,
    stateId: item.state_id,
    cases: item.cases,
    cured: item.cured,
    active: item.active,
    deaths: item.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getSingleDistricts = `SELECT * FROM district WHERE district_id=${districtId}`;
    const dbResponse = await db.get(getSingleDistricts);
    response.send(returnDistrict(dbResponse));
  }
);

/// API 6

///Path: `/districts/:districtId/`

///Method: `DELETE`

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictId = `DELETE FROM district WHERE district_id=${districtId}`;
    const dbResponse = await db.run(deleteDistrictId);
    response.send("District Removed");
  }
);

///API 7

/// Path: `/districts/:districtId/`

///Method: `PUT`

app.put(
  "/districts/:districtId/",
  authenticationToken,
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
    const updateQuery = `UPDATE district SET
                         district_name='${districtName}',
                         state_id=${stateId},
                         deaths=${deaths},
                         cured=${cured},
                         active=${active},
                         cases=${cases} where district_id=${districtId}`;
    const dbResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

///API 8
//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateByIDStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured,
    sum(active) as totalActive , sum(deaths) as totalDeaths from district where state_id = ${stateId};`;

    const getStateByIDStatsQueryResponse = await db.get(getStateByIDStatsQuery);
    response.send(getStateByIDStatsQueryResponse);
  }
);

module.exports = app;
