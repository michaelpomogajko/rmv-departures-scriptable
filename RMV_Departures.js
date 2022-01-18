const now = new Date();

const month = (now.getMonth() + 1).toString().padStart(2, '0');
const nowformatted = `${now.getDate()}.${month} ${now.getHours()}:${now.getMinutes()}`;

const BASE_URL = 'https://www.rmv.de/hapi/latest';

const config = {
  urls: {
    stops: `${BASE_URL}/location.nearbystops`,
    departures: `${BASE_URL}/departureBoard`
  },
  maxJourneys: 3,
  refreshInterval: 1000 * 60,
  bgColor: new Color('#068471'),
};

const defaultParams = {
  accessId: args.widgetParameter,
  format: 'json',
}

const fetch = async (url, params) => {
  const query = Object.keys(params).map(key => key + '=' + params[key]).join('&');
  const fetchUrl = url + '?' + query;
  try {
    const data = await new Request(fetchUrl).loadJSON();
    return data;
  } catch (e) {
    console.error(e);
    return {}
  }
}

// const getLocation = async () => {
//   try {
//     if (args.widgetParameter) {
//       let fixedCoordinates = args.widgetParameter.split(",").map(parseFloat)
//       return { latitude: fixedCoordinates[0], longitude: fixedCoordinates[1] }
//     } else {
//       return await Location.current()
//     }
//   } catch (e) {
//     return null;
//   }
// }

console.log(args.widgetParameter);

const getNearbyStop = async (location) => {
  const params = {
    ...defaultParams,
    originCoordLat: location.lat,
    originCoordLong: location.long,
  };

  const data = await fetch(config.urls.stops, params)
  console.log('data');
  console.log(data);
  const stopId = data.stopLocationOrCoordLocation[0].StopLocation.extId;
  const name = data.stopLocationOrCoordLocation[0].StopLocation.name;

  return { name, stopId };
}


const getDepartures = async (stopId) => {
  const params = {
    ...defaultParams,
    id: stopId,
    maxJourneys: config.maxJourneys
  }

  const data = await fetch(config.urls.departures, params)

  return data.Departure.map(dep => ({
    line: dep.name,
    time: dep.rtTime || dep.time,
    direction: dep.direction
  }));
}


const getData = async () => {
  const { latitude, longitude } = await Location.current();
  const { name, stopId } = await getNearbyStop({ lat: latitude, long: longitude });
  const departures = await getDepartures(stopId);
  return { currentStop: name, departures };
}

const createWidget = async () => {
  const { currentStop, departures } = await getData();

  let widget = new ListWidget()

  widget.setPadding(8, 8, 8, 8)
  widget.backgroundColor = config.bgColor;
  let headlineStack = widget.addStack()
  headlineStack.layoutVertically()
  headlineStack.topAlignContent()

  let headline = headlineStack.addText('🚍 ' + currentStop);
  headline.font = Font.mediumSystemFont(16)
  headline.centerAlignText();

  headlineStack.addSpacer()

  departures.forEach(dep => {
    let depStack = widget.addStack();
    let line = depStack.addText(dep.line);
    line.leftAlignText();
    let time = depStack.addText(dep.time.slice(0, -3));
    time.centerAlignText();
    let dir = depStack.addText(dep.direction);
    dir.rightAlignText();
    depStack.addSpacer();
  })

  widget.refreshAfterDate = new Date(Date.now() + config.refreshInterval);
  return widget;
}


const widget = await createWidget();

if (config.runsInWidget) {
  // Runs inside a widget so add it to the homescreen widget
  Script.setWidget(widget);
} else {
  // Show the medium widget inside the app
  widget.presentMedium();
}
Script.complete();