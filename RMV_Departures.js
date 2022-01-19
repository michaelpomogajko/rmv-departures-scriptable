const BASE_URL = 'https://www.rmv.de/hapi/latest';

const config = {
  urls: {
    stops: `${BASE_URL}/location.nearbystops`,
    departures: `${BASE_URL}/departureBoard`
  },
  maxJourneys: 4,
  refreshInterval: 1000 * 60,
};


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

const getAccessId = () => {
  const accessId = args.widgetParameter;
  console.log(JSON.stringify({ accessId }));
  if (!accessId || accessId.length === 0) {
    console.error('No accessId found');
    return null;
  }
  return accessId;
}

const getNearbyStop = async (location) => {
  const accessId = getAccessId();
  const params = {
    accessId,
    format: 'json',
    originCoordLat: location.lat,
    originCoordLong: location.long,
  };

  const data = await fetch(config.urls.stops, params)
  const stopId = data.stopLocationOrCoordLocation[0].StopLocation.extId;
  const name = data.stopLocationOrCoordLocation[0].StopLocation.name;

  return { name, stopId };
}


const getDepartures = async (stopId) => {
  const accessId = getAccessId();
  const params = {
    accessId,
    format: 'json',
    id: stopId,
    maxJourneys: config.maxJourneys
  }

  const data = await fetch(config.urls.departures, params)

  const sanitizedDir = (direction) => {
    if (direction.length > 26) {
      return direction.slice(0, 22) + '..'
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
  const accessId = getAccessId();
  if (!accessId) {
    let errorWidget = new ListWidget();
    let stack = errorWidget.addStack();
    stack.layoutVertically();
    let errrorText = stack.addText('No RMV API Key provided!');
    errorText.font = Font.title();
    let message = stack.addText('Please add API key to widget parameters');
    errorWidget.addTex('No RMV API Key provided!')

    return errorWidget;
  }

  const { currentStop, departures } = await getData();

  let widget = new ListWidget();
  let nextRefresh = Date.now() + 1000 * 30 // add 30 second to now
  widget.refreshAfterDate = new Date(nextRefresh)

  widget.useDefaultPadding();
  // widget.backgroundColor = config.bgColor;
  let headlineStack = widget.addStack();
  let headline = headlineStack.addText('🚍 ' + currentStop);
  headline.font = Font.mediumSystemFont(16)

  widget.addSpacer();

  let depStack = widget.addStack();
  depStack.layoutVertically();

  for (const [idx, dep] of departures.entries()) {
    if (idx === config.maxJourneys) break;

    let rowStack = depStack.addStack();
    rowStack.setPadding(2, 4, 2, 4)
    rowStack.cornerRadius = 5;
    if ((idx % 2)) {
      rowStack.backgroundColor = new Color('#333333');
    } else {
      rowStack.backgroundColor = new Color('#222222');
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

  widget.addSpacer();

  const lastUpdatedStack = widget.addStack();
  lastUpdatedStack.setPadding(2, 4, 2, 4);
  lastUpdatedStack.addSpacer();
  const lastUpdated = lastUpdatedStack.addText('Last Update:  ' + getTime())
  lastUpdated.font = Font.lightSystemFont(10);
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