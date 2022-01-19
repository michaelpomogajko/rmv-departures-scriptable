
/* Config */
const BASE_URL = 'https://www.rmv.de/hapi/latest';
const API_KEY = args.widgetParameter;
const MAX_JOURNEYS = 4;
const URLS = {
  stops: BASE_URL + '/location.nearbystops',
  departures: BASE_URL + '/departureBoard',
}

const MAX_CHAR_LENGTH = 24;

const DEFAULT_PARAMS = {
  accessId: API_KEY,
  format: 'json',
}

const GRADIENT_COLORS = ['#4b749f', '#243748'];


const gradient = new LinearGradient();
gradient.colors = GRADIENT_COLORS.map(color => new Color(color));
gradient.locations = [0, 1];

if (!API_KEY || !API_KEY.length) {
  console.warn('No API_KEY found!');
}

const getTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const fetch = async (url, params) => {
  const query = Object.keys(params).map(key => key + '=' + params[key]).join('&');
  const fetchUrl = url + '?' + query;
  try {
    const data = await new Request(fetchUrl).loadJSON();
    return data;
  } catch (e) {
    cosole.error('Error fetching data');
    console.error(e);
    return {}
  }
}

const getNearbyStop = async (location) => {
  const params = {
    ...DEFAULT_PARAMS,
    originCoordLat: location.lat,
    originCoordLong: location.long,
  };

  const data = await fetch(URLS.stops, params)
  const stopId = data.stopLocationOrCoordLocation[0].StopLocation.extId;
  const name = data.stopLocationOrCoordLocation[0].StopLocation.name;

  return { name, stopId };
}


const getDepartures = async (stopId) => {
  const params = {
    ...DEFAULT_PARAMS,
    id: stopId,
    maxJourneys: MAX_JOURNEYS
  }

  const data = await fetch(URLS.departures, params)

  const sanitizedDir = (direction) => {
    if (direction.length >= MAX_CHAR_LENGTH) {
      return direction.slice(0, MAX_CHAR_LENGTH - 3) + '...'
    }
    return direction;
  }

  return data.Departure.map(dep => ({
    line: dep.name,
    time: (dep.rtTime || dep.time).slice(0, -3),
    direction: sanitizedDir(dep.direction)
  }));
}

const getLocation = async () => {
  const loc = {
    lat: 52.5,
    long: 13.4,
  };

  try {
    const { latitude, longitude } = await Location.current();
    loc.lat = latitude;
    loc.long = longitude;
    return loc;
  } catch (error) {
    console.error('Cannot get location');
    return loc;
  }
}



const getData = async () => {
  const { lat, long } = await getLocation();

  const startReqTime = Date.now();
  const { name, stopId } = await getNearbyStop({ lat, long });
  const departures = await getDepartures(stopId);
  const stopReqTime = Date.now();
  console.log('Request took ' + (stopReqTime - startReqTime) / 1000 + 's');

  return { currentStop: name, departures };
}

const createWidget = async () => {
  if (!API_KEY) {
    let errorWidget = new ListWidget();
    let stack = errorWidget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();
    let errorText = stack.addText('No RMV API Key provided!');
    errorText.font = Font.title2();
    let message = stack.addText('Please add API key to widget parameters');

    return errorWidget;
  }

  const { currentStop, departures } = await getData();

  let widget = new ListWidget();
  widget.backgroundGradient = gradient;
  let nextRefresh = Date.now() + 1000 * 30 // add 30 second to now
  widget.refreshAfterDate = new Date(nextRefresh)

  widget.useDefaultPadding();
  let headline = widget.addText('🚍 ' + currentStop);
  headline.lineLimit = 1;
  headline.font = Font.mediumSystemFont(16)

  widget.addSpacer();

  let depStack = widget.addStack();
  depStack.layoutVertically();

  for (const [idx, dep] of departures.entries()) {
    if (idx === MAX_JOURNEYS) break;

    let rowStack = depStack.addStack();
    rowStack.setPadding(2, 4, 2, 4)
    rowStack.cornerRadius = 5;
    if ((idx % 2)) {
      rowStack.backgroundColor = new Color('#11111160');
    } else {
      rowStack.backgroundColor = new Color('#22222260');
    }

    let lineCell = rowStack.addStack();
    lineCell.layoutVertically();
    lineCell.size = new Size(40, 16);
    let line = lineCell.addText(dep.line);
    line.leftAlignText();
    line.font = Font.mediumMonospacedSystemFont(14)
    rowStack.addSpacer(16);

    let time = rowStack.addText(dep.time);
    time.font = Font.regularMonospacedSystemFont(14)
    rowStack.addSpacer();

    let dir = rowStack.addText(dep.direction);
    dir.font = Font.regularMonospacedSystemFont(14)
    dir.rightAlignText();
    depStack.addSpacer(2);
  }

  // widget.addSpacer();

  const lastUpdatedStack = widget.addStack();
  lastUpdatedStack.setPadding(2, 4, 2, 4);
  lastUpdatedStack.addSpacer();
  const lastUpdated = lastUpdatedStack.addText('Last Update:  ' + getTime())
  lastUpdated.font = Font.lightSystemFont(10);
  lastUpdated.textColor = new Color('#eeeeee');
  lastUpdatedStack.addSpacer();

  return widget;
}

const widget = await createWidget();

if (config.runsInWidget) {
  Script.setWidget(widget);
  Script.complete();
} else {
  widget.presentMedium();
}