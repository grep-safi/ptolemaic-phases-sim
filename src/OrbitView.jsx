import React from 'react';
import PropTypes from 'prop-types';
import * as PIXI from 'pixi.js'
import * as d3 from 'd3-scale';
import { PlanetTypes } from './enums.jsx';
import PathTracer from './pathTracer.js';

/**
 * Data Table for each of the Constellations and the filepaths to their
 * images.  Will be loaded into Sprites and displayed around the edges of
 * the OrbitView.
 */
const CONSTELLATION_TABLE = [
    ['img/pisces.svg', 'Pisces'],
    ['img/aries.svg', 'Aries'],
    ['img/taurus.svg', 'Taurus'],
    ['img/gemini.svg', 'Gemini'],
    ['img/cancer.svg', 'Cancer'],
    ['img/leo.svg', 'Leo'],
    ['img/virgo.svg', 'Virgo'],
    ['img/libra.svg', 'Libra'],
    ['img/scorpio.svg', 'Scorpio'],
    ['img/sagittarius.svg', 'Sagittarius'],
    ['img/capricorn.svg', 'Capricorn'],
    ['img/aquarius.svg', 'Aquarius']
];

/**
 * OrbitView is the main graphic container that displays the animations.
 * The only interface it has is the draggable sun, which affects both the
 * animation and the ZodiacStrip.
 */
export default class OrbitView extends React.Component {
    constructor(props) {
        super(props);
        this.animationFrameLoop = this.animationFrameLoop.bind(this);

        /**
         * Side Length is used to determine the legnth of a side of the PIXI
         * Canvas.  Both Width and Height will be set to the side length,
         * this is to make the drawings independent from the actual pixel
         * dimensions of the drawings.
         * @type {Number}
         */
        this.sideLength = 700;

        this.pixiElement = null;
        this.app = null;

        this.earthGraphic = this.newEarthGraphic();
        this.equantGraphic = this.newEquantGraphic();
        this.eccentricGraphic = this.newEccentricGraphic();
        this.sunGraphic = this.newSunGraphic();
        this.planetGraphic = this.newPlanetGraphic();

        this.arrowToSun = this.drawArrows();
        this.arrowToEarth = this.drawArrows();

        this.elongationArc = this.drawArc();

        this.overlay = new PIXI.Graphics();
        this.epicycle = new PIXI.Graphics();
        this.constellations = {};

        /**
         *  Current Time (in Simulation units: Earth Years).
         *  It is Incremented with every frame. It only increases.
        */
        this.currentTime = 0;

        /**
         * lastTimestamp is used by animationFrameLoop function to keep track
         * of how much time passes in between each frame.  Used to calculate
         * delta time.
         */
        this.lastTimestamp = 0;

        /* Deferent and Epicycle Angles are saved and incremented with each
        time step. The save-and-increment approach works better for these 
        variables, because doing a full recalculation each frame can result in
        the planety rapidly teleporting around the screen while the user
        is adjusting the "MotionRate" parameter.  */
        this.deferentAngle = 0;
        this.epicycleAngle = 0;

        this.pathTracer = new PathTracer(0.2);

        /* Variables for Dragging */
        this.isSunDragging = false;
        this.sunDraggingEventData = null;
        this.deltaTimeFromDrag = 0;
    }

    componentDidMount() {
        this.app = new PIXI.Application({
            antialias: true,
            resolution: Math.min(window.devicePixelRatio, 3) || 1,
            autoDensity: true,
            width: this.sideLength,
            height: this.sideLength,
        });
        this.app.renderer.plugins.interaction.autoPreventDefault = false;
        this.app.renderer.view.style['touch-action'] = 'auto';
        this.pixiElement.appendChild(this.app.view);
        // this.app.stage.addChild(rope);
        this.app.stage.addChild(this.pathTracer.getPixiObject());
        this.app.stage.addChild(this.overlay);
        this.app.stage.addChild(this.arrowToEarth);
        this.app.stage.addChild(this.arrowToSun);
        this.app.stage.addChild(this.elongationArc);
        this.app.stage.addChild(this.earthGraphic);
        this.app.stage.addChild(this.sunGraphic);
        this.app.stage.addChild(this.equantGraphic);
        this.app.stage.addChild(this.eccentricGraphic);
        this.app.stage.addChild(this.planetGraphic);
        this.app.stage.addChild(this.epicycle);

        // this.loadConstellations();
        this.updateAll(0); // initial update.
        this.pathTracer.clear(this.planetGraphic.x, this.planetGraphic.y);
        this.animationFrameIdentifier = window.requestAnimationFrame(this.animationFrameLoop);
    }

    componentDidUpdate(prevProps) {
        /* When path duration changes, Do... */
        if (prevProps.controls.pathDuration !== this.props.controls.pathDuration) {
            this.pathTracer.setPathLength(this.props.controls.pathDuration);
        }

        /* When Planet Type changes, Do... */
        if (prevProps.planetaryParameters.planetType !== this.props.planetaryParameters.planetType) {
            let sunAngle = 2 * Math.PI * this.currentTime;
            if (this.props.planetaryParameters.planetType === PlanetTypes.SUPERIOR) {
                this.epicycleAngle = sunAngle;
            } else {
                this.deferentAngle = sunAngle;
            }
            this.updateAll(0);
            this.pathTracer.clear(this.planetGraphic.x, this.planetGraphic.y);
        }

        /* When Animation is playing */
        if (prevProps.controls.isAnimationEnabled !== this.props.controls.isAnimationEnabled) {
            this.sunGraphic.interactive = !this.props.controls.isAnimationEnabled;
        }
    }

    loadConstellations() {
        let angle = 0;
        for (let row of CONSTELLATION_TABLE) {
            let filepath = row[0];
            // let name = row[1];
            let sprite = PIXI.Sprite.from(filepath);
            // this.constellations[name] = sprite;
            this.app.stage.addChild(sprite);
            sprite.width = this.sideLength * 0.08;
            sprite.height = this.sideLength * 0.08;
            sprite.anchor.set(0.5);
            sprite.x = this.xUnitsToPixels(3.6 * Math.cos(angle));
            sprite.y = this.yUnitsToPixels(3.6 * Math.sin(angle));
            angle += Math.PI / 6;
        }
    }

    render() {
        return (
            <React.Fragment>
            <div
                className="OrbitView"
                ref={(thisDiv) => { this.pixiElement = thisDiv; }}
            />
            {/*
            <pre>{JSON.stringify(this.state, null, '\t')}</pre>
            */}
            </React.Fragment>
        )
    }

    /**
     * animationFrameLoop is called by the window.requestAnimationFrame
     * function, and is the core animation loop.  The timestamp is provided
     * automatically.
     */
    animationFrameLoop(timestamp) {
        let delta = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        this.updateAll(delta);
        window.requestAnimationFrame(this.animationFrameLoop);
    }

    updateAll(delta) {
        this.physicsUpdate(delta);
        this.update();
    }

    update() {
        this.updateSun();
        this.updateEquant();
        this.updateEccentric();
        this.updatePlanet();
        this.updateArrows();
        this.updateArc();
        this.updateOverlay();
    }

    /**
     * Converts x-coordinates from the graph in (-3, 3), to the pixel
     * coordinates that can be drawn on the canvas.
     */
    xUnitsToPixels(x) {
        return (x + 4) * this.sideLength / 8;
    }

    /**
     * Converts y-coordinates from the graph in (-3, 3), to the pixel
     * coordinates that can be drawn on the canvas.
     */
    yUnitsToPixels(y) {
        return -(y - 4) * this.sideLength / 8;
    }

    /**
     * Resets the simulation to time = 0, which is the initial default state.
     */
    reset() {
        this.currentTime = 0;
        this.deferentAngle = 0;
        this.epicycleAngle = 0;
        this.updateAll(0);
        this.pathTracer.clear(this.planetGraphic.x, this.planetGraphic.y);
    }

    /**
     * PhysicsUpdate is where the most important variables are updated.
     * Those variables are used by the other "update" functions.
     */
    physicsUpdate(delta) {

        delta = delta * this.props.controls.animationRate / 1000;

        /* Increment Time if Animation is On */
        if (this.props.controls.isAnimationEnabled === true) {
            this.currentTime += delta;
        }
        else if (this.isSunDragging === true) {
            this.currentTime += this.deltaTimeFromDrag;
            delta = this.deltaTimeFromDrag;
            this.deltaTimeFromDrag = 0;
        }
        let t = this.currentTime;
        this.props.onTimeChange(t);

        /* Alias Variables for Planetary Params */
        let ecc = this.props.planetaryParameters.eccentricity;
        let apogee = this.props.planetaryParameters.apogeeAngle;
        let motionRate = this.props.planetaryParameters.motionRate;
        let planetType = this.props.planetaryParameters.planetType;
        let R_e = this.props.planetaryParameters.epicycleSize;
        let R = 1;

        /* Toggle Planet Type */
        let epicycleRate = 1;
        let deferentRate = 1;
        if (planetType === PlanetTypes.SUPERIOR) {
            deferentRate = motionRate;
        } else {
            epicycleRate = motionRate;
        }

        /* Calculate Deferent Angle */
        let omega = 2 * Math.PI * deferentRate;
        if (this.props.controls.isAnimationEnabled === true || this.isSunDragging === true) {
            this.deferentAngle += omega * delta;
            this.epicycleAngle += 2 * Math.PI * epicycleRate * delta;
        }
        // this.deferentAngle = omega * t;
        // this.epicycleAngle = 2 * Math.PI * epicycleRate * t;

        /* Calculate Distance from Equant to Epicycle Center */
        let a = 1;
        let b = -2 * ecc * Math.cos(Math.PI - apogee * Math.PI / 180 + this.deferentAngle);
        let c = Math.pow(ecc, 2) - Math.pow(R, 2);
        let discriminant = Math.pow(b, 2) - 4 * a * c;
        let R_equant_epicycle = (-1 * b + Math.sqrt(discriminant)) / (2 * a);

        /* Calculate Equant Position */
        this.x_equant = 2 * ecc * Math.cos(apogee * Math.PI / 180);
        this.y_equant = 2 * ecc * Math.sin(apogee * Math.PI / 180);

        /* Calculate Deferent-Center Position */
        this.x_center = ecc * Math.cos(apogee * Math.PI / 180);
        this.y_center = ecc * Math.sin(apogee * Math.PI / 180);

        /* Calculate Deferent Position */
        this.x_deferent = R_equant_epicycle * Math.cos(this.deferentAngle);
        this.y_deferent = R_equant_epicycle * Math.sin(this.deferentAngle);

        /* Calculate Motion Around Epicycle */
        this.x_epicycle = R_e * Math.cos(this.epicycleAngle);
        this.y_epicycle = R_e * Math.sin(this.epicycleAngle);

        /* Calculate Planet */
        this.x_planet = this.x_equant + this.x_deferent + this.x_epicycle;
        this.y_planet = this.y_equant + this.y_deferent + this.y_epicycle;
        this.ecliptic_longitude = Math.atan2(this.y_planet, this.x_planet) * 180 / Math.PI;

        /* Calculate Sun */
        this.x_sun = 3 * R * Math.cos(2 * Math.PI * t);
        this.y_sun = 3 * R * Math.sin(2 * Math.PI * t);
        this.sun_longitude = Math.atan2(this.y_sun, this.x_sun) * 180 / Math.PI;

        /* Calculate Earth */
        this.x_earth = 0;
        this.y_earth = 0;

        let observerPos = {
            x: this.x_earth,
            y: this.y_earth,
        };

        let targetPos = {
            x: this.x_planet,
            y: this.y_planet,
        };

        let sunPos = {
            x: this.x_sun,
            y: this.y_sun,
        };

        let targetPlanetAngle = Math.atan2(observerPos.y - targetPos.y, observerPos.x - targetPos.x);
        let sunAngle = Math.atan2(sunPos.y - targetPos.y, sunPos.x - targetPos.x);

        if (-Math.PI < sunAngle && sunAngle < 0) {
            sunAngle += 2 * Math.PI;
        }

        if (-Math.PI < targetPlanetAngle && targetPlanetAngle < 0) {
            targetPlanetAngle += 2 * Math.PI;
        }

        let elongationAngle = targetPlanetAngle - sunAngle;

        if (elongationAngle < 0) {
            elongationAngle += 2 * Math.PI;
        }

        let minPix = 100;
        let maxPix = 275;

        const scale = d3.scaleLinear()
            .domain([0.0, 3.0])
            .range([maxPix, minPix]);


        let obsAngT = Math.atan2(observerPos.y - targetPos.y, observerPos.x - targetPos.x);
        let sunAngT = Math.atan2(sunPos.y - targetPos.y, sunPos.x - targetPos.x);

        /* Let the Longitudes be Known to other Components */
        this.props.onLongitudeChange({
            sun_longitude: this.sun_longitude,
            ecliptic_longitude: this.ecliptic_longitude,
            elongationAngle: elongationAngle,
            obsAngleTarget: obsAngT,
            sunAngleTarget: sunAngT,
            size: scale(this.getDistance(observerPos, targetPos))
        });

        /* For Debugging Purposes */
        // this.setState({
        //     t: t,
        //     x_equant: this.x_equant,
        //     y_equant: this.y_equant,
        //     x_center: this.x_center,
        //     y_center: this.y_center,
        //     x_deferent: this.x_deferent,
        //     y_deferent: this.y_deferent,
        //     x_planet: this.x_planet,
        //     y_planet: this.y_planet,
        //     ecliptic_longitude: this.ecliptic_longitude,
        //     x_sun: this.x_sun,
        //     y_sun: this.y_sun,
        //     sun_longitude: this.sun_longitude,
        // })
    }

    getDistance(firstBody, secondBody) {
        let diffX = Math.pow((firstBody.x - secondBody.x), 2);
        let diffY = Math.pow((firstBody.y - secondBody.y), 2);

        return Math.sqrt(diffX + diffY);
    }

    newEarthGraphic() {
        const g = new PIXI.Graphics();
        g.lineStyle(0.5, 0x000000, 1);
        g.beginFill(0x0000FF, 1);
        let w = this.sideLength / 2;
        let h = this.sideLength / 2;
        let r = this.sideLength / 155;
        g.drawCircle(w, h, r);
        g.endFill();
        return g;
    }

    newSunGraphic() {
        const g = new PIXI.Graphics();
        g.clear();
        g.lineStyle(0.5, 0x000000, 1);
        g.beginFill(0xf5c242, 1);
        g.drawCircle(0, 0, this.sideLength / 50);
        g.endFill();
        g.interactive = true;
        g.on('pointerdown', (event) => this.onSunDragStart(event));
        g.on('pointerup', (event) => this.onSunDragEnd(event));
        g.on('pointerupoutside', (event) => this.onSunDragEnd(event));
        g.on('pointermove', (event) => this.onSunDragMove(event));
        return g;
    }

    updateSun() {
        this.sunGraphic.x = this.xUnitsToPixels(this.x_sun);
        this.sunGraphic.y = this.yUnitsToPixels(this.y_sun);
    }

    newEquantGraphic() {
        const g = new PIXI.Graphics();
        let s = 0.01 * this.sideLength;
        g.lineStyle(3, 0x00FF00);
        g.moveTo(-s, 0);
        g.lineTo(s, 0);
        g.moveTo(0, -s);
        g.lineTo(0, s);
        g.endFill();
        return g;
    }

    updateEquant() {
        this.equantGraphic.x = this.xUnitsToPixels(this.x_equant);
        this.equantGraphic.y = this.yUnitsToPixels(this.y_equant);
    }

    newEccentricGraphic() {
        const g = new PIXI.Graphics();
        g.clear();
        g.lineStyle(0);
        g.beginFill(0x8455bd, 1);
        g.drawCircle(0, 0, 0.005 * this.sideLength);
        g.endFill();
        return g;
    }

    updateEccentric() {
        let x = this.xUnitsToPixels(this.x_center);
        let y = this.yUnitsToPixels(this.y_center);
        this.eccentricGraphic.x = x;
        this.eccentricGraphic.y = y;
    }

    newPlanetGraphic() {
        const g = new PIXI.Graphics();
        g.lineStyle(0.5, 0x000000);
        g.beginFill(0xEE0000, 1);
        g.drawCircle(0, 0, 0.01 * this.sideLength);
        g.endFill();
        return g;
    }

    drawArrows() {
        const g = new PIXI.Graphics();
        // g.visible = true;

        g.clear();
        g.lineStyle(4.0, 0xedb7b7);

        return g;
    }

    updatePlanet() {
        this.planetGraphic.x = this.xUnitsToPixels(this.x_planet);
        this.planetGraphic.y = this.yUnitsToPixels(this.y_planet);
        if ((this.props.controls.isAnimationEnabled === true && this.props.controls.animationRate !== 0) || this.isSunDragging) {
            this.pathTracer.addLocation(this.planetGraphic.x, this.planetGraphic.y);
        }
    }

    updateArrows() {
        this.arrowToSun.clear();
        this.arrowToEarth.clear();

        if (!this.props.controls.showElongationAngle) {
            return;
        }

        this.arrowToSun.lineStyle(3.5, 0xa64e4e);
        this.arrowToEarth.lineStyle(3.5, 0xa64e4e);

        this.arrowToSun.moveTo(this.planetGraphic.x, this.planetGraphic.y);
        this.arrowToEarth.moveTo(this.planetGraphic.x, this.planetGraphic.y);

        this.arrowToSun.lineTo(this.sunGraphic.x, this.sunGraphic.y);
        this.arrowToEarth.lineTo(this.sideLength / 2, this.sideLength / 2);
    }

    updateOverlay() {
        this.overlay.clear();
        if (this.props.controls.showDeferent === true) {
            let x = this.xUnitsToPixels(this.x_center);
            let y = this.yUnitsToPixels(this.y_center);
            let r = this.xUnitsToPixels(1) - this.xUnitsToPixels(0);
            this.overlay.lineStyle(2, 0xFFFFFF);
            this.overlay.drawCircle(x, y, r);
            this.overlay.endFill();
        }
        if (this.props.controls.showEarthSunLine === true) {
            this.overlay.lineStyle(2, 0xFFFFFF);
            this.overlay.moveTo(this.sideLength/2, this.sideLength/2);
            this.overlay.lineTo(this.sunGraphic.x, this.sunGraphic.y);
        }
        if (this.props.controls.showEquantVector === true) {
            let x1 = this.xUnitsToPixels(this.x_equant);
            let y1 = this.yUnitsToPixels(this.y_equant);
            let x2 = this.xUnitsToPixels(this.x_deferent + this.x_equant);
            let y2 = this.yUnitsToPixels(this.y_deferent + this.y_equant);
            this.overlay.lineStyle(2, 0xFFFFFF);
            this.overlay.moveTo(x1, y1);
            this.overlay.lineTo(x2, y2);
            this.overlay.endFill();
        }
        if (this.props.controls.showEpicycle === true) {
            let epicycleSize = this.props.planetaryParameters.epicycleSize;
            let x = this.xUnitsToPixels(this.x_equant + this.x_deferent);
            let y = this.yUnitsToPixels(this.y_equant + this.y_deferent);
            let r = this.xUnitsToPixels(epicycleSize) - this.xUnitsToPixels(0);
            this.overlay.lineStyle(2, 0xFFFFFF);
            this.overlay.drawCircle(x, y, r);
            this.overlay.endFill();
        }
        if (this.props.controls.showEpicyclePlanetLine === true) {
            let x1 = this.xUnitsToPixels(this.x_deferent + this.x_equant);
            let y1 = this.yUnitsToPixels(this.y_deferent + this.y_equant);
            let x2 = this.xUnitsToPixels(this.x_planet);
            let y2 = this.yUnitsToPixels(this.y_planet);
            this.overlay.lineStyle(2, 0xFFAAAA);
            this.overlay.moveTo(x1, y1);
            this.overlay.lineTo(x2, y2);
            this.overlay.endFill();
        }
        if (this.props.controls.showEccentricDeferentLine === true) {
            let x1 = this.xUnitsToPixels(this.x_center);
            let y1 = this.yUnitsToPixels(this.y_center);
            let x2 = this.xUnitsToPixels(this.x_deferent + this.x_equant);
            let y2 = this.yUnitsToPixels(this.y_deferent + this.y_equant);
            this.overlay.lineStyle(2, 0x9ca2ff);
            this.overlay.moveTo(x1, y1);
            this.overlay.lineTo(x2, y2);
            this.overlay.endFill();
        }
        if (this.props.controls.showPlanetVector === true) {
            let x1 = this.xUnitsToPixels(0);
            let y1 = this.yUnitsToPixels(0);
            let x2 = this.xUnitsToPixels(this.x_planet);
            let y2 = this.yUnitsToPixels(this.y_planet);
            this.overlay.lineStyle(2, 0xFFFFFF);
            this.overlay.moveTo(x1, y1);
            this.overlay.lineTo(x2, y2);
            this.overlay.endFill();
        }
    }

    onSunDragStart(event) {
        this.isSunDragging = true;
        this.sunGraphic.alpha = 0.5;
        this.sunDraggingEventData = event.data;
    }

    onSunDragEnd(event) {
        this.isSunDragging = false;
        this.sunGraphic.alpha = 1;
        this.sunDraggingEventData = null;
    }

    onSunDragMove(event) {
        if (this.isSunDragging === true) {
            const newPosition = this.sunDraggingEventData.getLocalPosition(this.sunGraphic.parent);
            const lastAngle = Math.atan2(this.sideLength/2 - this.sunGraphic.y, this.sunGraphic.x - this.sideLength/2);
            const newAngle = Math.atan2(this.sideLength/2 - newPosition.y, newPosition.x - this.sideLength/2);
            let deltaAngle = newAngle - lastAngle;
            if ((lastAngle > Math.PI/2 && newAngle < -Math.PI/2)) {
                deltaAngle += 2 * Math.PI;
            }
            else if (lastAngle < -Math.PI/2 && newAngle > Math.PI/2) {
                deltaAngle -= 2 * Math.PI;
            }
            console.log()
            this.deltaTimeFromDrag += deltaAngle / (2 * Math.PI);
            this.x_sun = 3 * Math.cos(2 * Math.PI * (this.currentTime + this.deltaTimeFromDrag));
            this.y_sun = 3 * Math.sin(2 * Math.PI * (this.currentTime + this.deltaTimeFromDrag));
            this.updateSun();
        }
    }


















    drawArc() {
        const elongationArc = new PIXI.Graphics();
        elongationArc.visible = true;

        elongationArc.clear();
        elongationArc.lineStyle(2, 0xe8c3c3);
        elongationArc.arc(
            this.sideLength / 2,
            this.sideLength / 2,
            45,
            0,
            0,
            true
        );

        return elongationArc;
    }

    updateArc() {
        this.elongationArc.clear();
        // If the user deselects the box for showing
        // elongation arc, then simply return

        if (!this.props.controls.showElongationAngle) {
            return;
        }

        let focusedBody = this.planetGraphic;
        this.elongationArc.lineStyle(2.5, 0xa64e4e);
        this.elongationArc.moveTo(focusedBody.x, focusedBody.y);
        let east = this.greaterThan180();
        this.elongationArc.arc(
            focusedBody.x,
            focusedBody.y,
            20,
            -this.props.longitudes.obsAngleTarget,
            -this.props.longitudes.sunAngleTarget,
            east
        );

        this.updateArcArrow(east);
    }

    updateArcArrow(east) {
        let radii = [149, 172];
        let shift = 122;
        radii[0] -= shift;
        radii[1] -= shift;
        if (east) {
            // this.halfArrow(-0.09, -10.2, radii[0]);
            // this.halfArrow(-0.09, 10.2, radii[1]);

            this.halfArrow(-0.30, -10.2, radii[0]);
            this.halfArrow(-0.30, 10.2, radii[1]);

        } else {
            // this.halfArrow(0.085, 10.2, radii[0]);
            // this.halfArrow(0.085, -10.2, radii[1]);

            this.halfArrow(0.30, 10.2, radii[0]);
            this.halfArrow(0.30, -10.2, radii[1]);
        }
    }

    halfArrow(angleShift, angleReverse, rad) {
        this.elongationArc.lineStyle(2.5, 0xa64e4e);

        let smt = this.planetGraphic;

        let startX = smt.x;
        let startY = smt.y;

        let receive = this.closerY(angleShift, rad);
        let endX = receive.x;
        let endY = receive.y;

        let centrePointX = ((startX + endX) / 2.0);
        let centrePointY = ((startY + endY) / 2.0);

        let angle = Math.atan2(endY - startY, endX - startX) + angleReverse;
        let dist = 9;

        this.elongationArc.moveTo((Math.sin(angle) * dist + centrePointX), (-Math.cos(angle) * dist + centrePointY));
        this.elongationArc.lineTo((-Math.sin(angle) * dist + centrePointX), (Math.cos(angle) * dist + centrePointY));
    }

    closerY(angleShift, rad) {
        let smt = new PIXI.Point(this.sideLength / 2, this.sideLength / 2);

        let focusedBody = this.planetGraphic;
        let angle = Math.atan2(smt.y - focusedBody.y, smt.x - focusedBody.x) + angleShift;

        let radius = rad;
        let y = radius * Math.sin(angle);
        let x = radius * Math.cos(angle);

        return new PIXI.Point(focusedBody.x + x, focusedBody.y + y);
    }

    greaterThan180() {
        let sunAng = this.props.longitudes.sunAngleTarget;
        let targetAng = this.props.longitudes.obsAngleTarget;

        if (-Math.PI < this.props.longitudes.sunAngleTarget && this.props.longitudes.sunAngleTarget < 0) {
            sunAng += 2 * Math.PI;
        }

        if (-Math.PI < this.props.longitudes.obsAngleTarget && this.props.longitudes.obsAngleTarget < 0) {
            targetAng += 2 * Math.PI;
        }

        let differenceInAngles = targetAng - sunAng;

        if (differenceInAngles < 0) {
            differenceInAngles += 2 * Math.PI;
        }

        let num = Math.round(differenceInAngles * 180 / Math.PI * 10) / 10;

        if (num > 180) {
            return true;
        }

        return false;
    }
}

OrbitView.propTypes = {
    planetaryParameters: PropTypes.exact({
        epicycleSize:           PropTypes.number.isRequired,
        eccentricity:           PropTypes.number.isRequired,
        motionRate:             PropTypes.number.isRequired,
        apogeeAngle:            PropTypes.number.isRequired,
        planetType:             PropTypes.number.isRequired,
    }).isRequired,
    controls: PropTypes.exact({
        isAnimationEnabled:        PropTypes.bool.isRequired,
        animationRate:             PropTypes.number.isRequired,
        showDeferent:              PropTypes.bool.isRequired,
        showEpicycle:              PropTypes.bool.isRequired,
        showPlanetVector:          PropTypes.bool.isRequired,
        showEquantVector:          PropTypes.bool.isRequired,
        showEarthSunLine:          PropTypes.bool.isRequired,
        showEpicyclePlanetLine:    PropTypes.bool.isRequired,
        showEccentricDeferentLine: PropTypes.bool.isRequired,
        pathDuration:              PropTypes.number.isRequired
    }).isRequired,
    onLongitudeChange: PropTypes.func.isRequired,
    onTimeChange: PropTypes.func.isRequired,
}

