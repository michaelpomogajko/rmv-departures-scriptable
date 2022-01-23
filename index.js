
/* Config */
const BASE_URL = 'https://www.rmv.de/hapi/latest';
let API_KEY = args.widgetParameter;
const FALLBACK_API_KEY = ''; // paste in your api key for debugging inside scriptable app
const MAX_JOURNEYS = 4;
const URLS = {
  stops: BASE_URL + '/location.nearbystops',
  departures: BASE_URL + '/departureBoard',
}

const NOW = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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
  if (!args.runsInWidget) {
    API_KEY = FALLBACK_API_KEY;
  }
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
    return null;
  }
}


const getLocation = async () => {
  try {
    const { latitude, longitude } = await Location.current();
    console.log(`Lat: ${latitude}, Long: ${longitude}`);
    return { lat: latitude, long: longitude };
  } catch (e) {
    console.error('Cannot get location');
    console.error(e);
    return null;
  }
}

const getNearbyStop = async (location) => {
  const params = {
    ...DEFAULT_PARAMS,
    originCoordLat: location.lat,
    originCoordLong: location.long,
  };

  try {
    const data = await fetch(URLS.stops, params)
    if (!data || !data.stopLocationOrCoordLocation) {
      throw new Error('No stops found');
    }

    const stopId = data.stopLocationOrCoordLocation[0].StopLocation.extId;
    const name = data.stopLocationOrCoordLocation[0].StopLocation.name;

    return { name, stopId };

  } catch (e) {
    console.error('Error fetching nearby stops');
    console.error(e);
    return null;
  }

}


const getDepartures = async (stopId) => {
  const params = {
    ...DEFAULT_PARAMS,
    id: stopId,
    maxJourneys: MAX_JOURNEYS
  }

  const data = await fetch(URLS.departures, params)

  if (!data || !data.Departure) {
    return null;
  }

  return data.Departure.map(dep => ({
    line: dep.name.replace('Frankfurt (Main)', 'FFM'),
    time: (dep.rtTime || dep.time).slice(0, -3),
    direction: dep.direction.length >= MAX_CHAR_LENGTH ? dep.direction.substring(0, MAX_CHAR_LENGTH) + '...' : dep.direction,
  }));
}

const ErrorWidget = (title, message) => {
  let errorWidget = new ListWidget();
  errorWidget.backgroundGradient = gradient;
  let stack = errorWidget.addStack();
  stack.layoutVertically();
  stack.centerAlignContent();
  let widgetTitle = stack.addText(title);
  if (message) {
    widgetTitle.font = Font.title2();
    stack.addText(message);
  }

  return errorWidget;
}


const getData = async () => {
  const location = await getLocation();

  if (!location) return {
    error: {
      title: `Can't get location!`,
      message: `Please try again later`
    }
  }

  const nearByStop = await getNearbyStop(location);

  if (!nearByStop) {
    return {
      error: {
        title: `Can't get nearby stops!`,
        message: `Please try again later`
      }
    }
  }

  const { name, stopId } = nearByStop;

  const departures = await getDepartures(stopId);

  if (!departures) {
    return {
      error: {
        title: `Can't get departures!`,
        message: `Please try again later`
      }
    }
  }

  return { currentStop: name, departures };
}

const createWidget = async () => {
  const { currentStop, departures, error } = await getData();

  if (error) {
    return ErrorWidget(error.title, error.message);
  }


  let widget = new ListWidget();
  widget.backgroundGradient = gradient;
  let nextRefresh = Date.now() + 1000 * 30
  widget.refreshAfterDate = new Date(nextRefresh)

  widget.useDefaultPadding();
  let headline = widget.addText('🚍 ' + currentStop);
  headline.lineLimit = 1;
  headline.font = Font.mediumSystemFont(16)

  widget.addSpacer();

  let depStack = widget.addStack();
  depStack.layoutVertically();


  departures.forEach((dep, idx) => {
    if (idx >= MAX_JOURNEYS) return;

    let rowStack = depStack.addStack();
    rowStack.setPadding(2, 4, 2, 4)
    rowStack.cornerRadius = 5;
    if (idx % 2) {
      rowStack.backgroundColor = new Color('#11111160');
    } else {
      rowStack.backgroundColor = new Color('#22222260');
    }

    let lineCell = rowStack.addStack();
    lineCell.layoutVertically();
    lineCell.size = new Size(60, 16);
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
  })

  const lastUpdatedStack = widget.addStack();
  lastUpdatedStack.setPadding(2, 4, 2, 4);
  lastUpdatedStack.addSpacer();
  const lastUpdated = lastUpdatedStack.addText('Last Update:  ' + NOW)
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