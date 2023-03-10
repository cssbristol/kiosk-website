let events = [];
let eventsToDisplay = [];
let companies = [];
let bgCheck = null;

const delay = ms => new Promise(res => setTimeout(res, ms));

window.addEventListener("load", () => {
    // bgCheck = new BackgroundCheck("bg-check-target", "background");
    main()
});

async function main() {
    events = await loadEvents();
    eventsToDisplay = await loadEventsToDisplay();
    companies = await loadCompanies();

    setInterval(async () => {
        events = await loadEvents();
        eventsToDisplay = await loadEventsToDisplay();
        companies = await loadCompanies();
    }, 5 * 60 * 1000);

    while (true) {
        if (eventsToDisplay.length > 0)
            await displayEvents();
        else
            await delay(1000);
    }
}

async function loadCompanies() {
    let r = await fetch("https://api.github.com/repos/cssbristol/cssbristol.github.io/contents/_companies");
    let companies = await r.json();
    let promises = [];
    for (let company of companies) {
        let promise = fetch(company.download_url)
        .then(r => r.text())
        .then(text => {
            let data = extractor(text);
            company.attributes = data.attributes;
        });
        promises.push(promise);
    }
    await Promise.all(promises);
    return companies;
}

function findCompany(companyName) {
    for (let company of companies)
        if (company.attributes.name.toLowerCase() === companyName.toLowerCase())
            return company;
    
    return {
        attributes: {
            name: "",
            logo: "",
            link: ""
        }
    };
}

async function loadEvents() {
    let r = await fetch("https://api.github.com/repos/cssbristol/cssbristol.github.io/contents/_events");
    let events = await r.json();
    let promises = [];
    for (let event of events) {
        let promise = fetch(event.download_url)
        .then(r => r.text())
        .then(text => {
            event.text = text;
            let data = extractor(event.text);
            event.attributes = data.attributes;
            event.attributes.date = new Date(event.attributes.date.replace(" ", "T").replace(" ", ""));
            event.attributes.date_end = new Date(event.attributes.date_end.replace(" ", "T").replace(" ", ""));
            event.body = data.body;
        });
        promises.push(promise);
    }
    await Promise.all(promises);
    return events;
}

async function loadEventsToDisplay() {
    let eventsToDisplay = [];
    const now = new Date();
    for (let event of events) {
        if (now < event.attributes.date_end) {
            eventsToDisplay.push(event);
        }
    }

    return eventsToDisplay;
}

async function displayEvents() {
    let yetToDisplay = [...eventsToDisplay];
    while (yetToDisplay.length > 0) {
        let event = yetToDisplay.pop();
        displayEvent(event);
        await delay(15 * 1000);
    }
}

function displayEvent(event) {
    const now = new Date();
    let body = document.body;
    let videoContainer = document.getElementById("video-background");
    let sponsorsContainer = document.getElementById("sponsors");
    let QRCodeElement = document.getElementById("qr-code");
    let eventTitleElement = document.getElementById("event-title");
    let descriptionElement = document.getElementById("description");
    let startingInElement = document.getElementById("starting-in");
    let singleDayContainer = document.getElementById("single-day");
    let multiDayContainer = document.getElementById("multi-day");
    let dateElement = document.getElementById("date");
    let timeElement = document.getElementById("time");
    let startElement = document.getElementById("start-date");
    let endElement = document.getElementById("end-date");
    let locationElement = document.getElementById("location");

    const kioskDefault = {
        title: event.attributes.title || "",
        background: event.attributes.banner ? "https://cssbristol.co.uk/assets/images/contrib/events/" + event.attributes.banner : undefined,
        description: event.body.substring(0, 150) + "..." || "",
        show_sponsors: true,
        show_date: true
    }
    let kioskOptions = {...kioskDefault, ...event.attributes.kiosk};

    if (kioskOptions.background === undefined) {
        kioskOptions.background = "default_background.png";
    } else if (!kioskOptions.background.startsWith("http")) {
        kioskOptions.background = "https://cssbristol.co.uk/assets/images/contrib/events/" + kioskOptions.background;
    }

    if (kioskOptions.background.match(/\.(jpg|jpeg|png|gif)$/i)) {
        videoContainer.style.display = "none";
        body.style.backgroundImage = `url(${kioskOptions.background}), url(default_background.png)`;
    } else {
        videoContainer.style.display = "";
        videoContainer.innerHTML = "";
        let source = document.createElement("source");
        source.src = kioskOptions.background;
        videoContainer.appendChild(source);
    }

    sponsorsContainer.innerHTML = "";
    if (kioskOptions.show_sponsors) {
        for (let cohost of event.attributes.cohost || []) {
            let company = findCompany(cohost.company);
            let logoURL = "https://cssbristol.co.uk/assets/images/contrib/companies/" + company.attributes.logo;

            let sponsorElement = document.createElement("img");
            sponsorElement.classList.add("bg-check-target");
            sponsorElement.src = logoURL;

            sponsorsContainer.appendChild(sponsorElement);
        }
    }
   
    eventTitleElement.innerText = kioskOptions.title;

    let timeToStart = event.attributes.date - now;
    if (timeToStart < 0) {
        startingInElement.style.display = "";
        startingInElement.innerText = "In progress";
    } else if (timeToStart < 60 * 60 * 1000) {
        startingInElement.style.display = "";
        let minutes = Math.floor(timeToStart / 60 / 1000);
        startingInElement.innerText = `Starting in ${minutes} minute` + (minutes === 1 ? "" : "s");
    } else if (timeToStart < 24 * 60 * 60 * 1000) {
        startingInElement.style.display = "";
        let hours = Math.floor(timeToStart / 60 / 60 / 1000);
        startingInElement.innerText = `Starting in ${hours} hour` + (hours === 1 ?  "" : "s");
    } else {
        startingInElement.style.display = "none";
    }

    let startDate = event.attributes.date.toLocaleDateString("en-GB");
    let endDate = event.attributes.date_end.toLocaleDateString("en-GB");
    let startTime = event.attributes.date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(" ", "").toLowerCase();
    let endTime = event.attributes.date_end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).replace(" ", "").toLowerCase();
    if (kioskOptions.show_date === false) {
        singleDayContainer.style.display = "none";
        multiDayContainer.style.display = "none";
    } else if (startDate === endDate) {
        singleDayContainer.style.display = "";
        multiDayContainer.style.display = "none";
        dateElement.innerText = startDate;
        timeElement.innerText = `${startTime} to ${endTime}`;
    } else {
        singleDayContainer.style.display = "none";
        multiDayContainer.style.display = "";
        startElement.innerText = `${startDate} ${startTime}`;
        endElement.innerText = `${endDate} ${endTime}`;
    }

    locationElement.innerText = event.attributes.location;

    descriptionElement.innerText = kioskOptions.description;

    let url = "https://cssbristol.co.uk/events/" + event.name.replace(".md", "");
    QRCodeElement.innerHTML = "";
    new QRCode(QRCodeElement, {
        text: url,
        width: 220,
	    height: 220,
    });

    // let img = new Image();
    // img.src = kioskOptions.background;
    // img.onload = () => {
    //     bgCheck.check();
    // }
    // if (img.complete) img.onload();
}