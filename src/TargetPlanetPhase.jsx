import React from 'react';
import * as PIXI from 'pixi.js';
import * as d3 from 'd3-scale';

const WIDTH = 600;
const HEIGHT = 300;

const MAINVIEW_WIDTH = 600;
const MAINVIEW_HEIGHT = 460;

const getPlanetPos = function(radius, phase) {
    return new PIXI.Point(
        radius * Math.cos(-phase) + MAINVIEW_WIDTH,
        radius * Math.sin(-phase) + MAINVIEW_HEIGHT);
};

export default class TargetPlanetPhase extends React.Component {
    constructor(props) {
        super(props);

        this.center = new PIXI.Point(WIDTH / 2, HEIGHT / 2);
    }

    render() {
        return (
            <div className="ZodiacStrip"
                 ref={(thisDiv) => {this.el = thisDiv;}} />
        );
    }

    componentDidMount() {
        this.app = new PIXI.Application({
            width: WIDTH,
            height: HEIGHT,
            backgroundColor: 0x241B23,

            antialias: true,
            resolution: Math.min(window.devicePixelRatio, 3) || 1,
            autoDensity: true
        });

        this.el.appendChild(this.app.view);

        const stage = new PIXI.Container();
        this.app.stage.addChild(stage);

        this.targetPlanet = this.drawTargetPlanetZodiac();

        this.elongationText = this.drawText('Elongation: 180', 15, 10);
        this.elongationDirectionText = this.drawText('', 160, 10);
        // this.distanceText = this.drawText(`observer-target distance: \n${this.getDistanceBetweenBodies()} au`, 390, 10);
        this.drawShades();
        this.drawPhase(this.leftShade, this.rightShade, this.convertPhase(Math.PI), 1.002 * (275 / 2));
    }

    componentDidUpdate(prevProps) {
        if (prevProps !== this.props) this.animate();
    }

    getDistanceBetweenBodies() {
        // const firstRad = this.props.radiusAUObserver;
        // const secondRad = this.props.radiusAUTarget;
        //
        // const firstAng = this.props.observerPlanetAngle;
        // const secondAng = this.props.targetPlanetAngle;
        //
        // const firstBody = new PIXI.Point(firstRad * Math.cos(-firstAng), firstRad * Math.sin(-firstAng));
        // const secondBody = new PIXI.Point(secondRad * Math.cos(-secondAng), secondRad * Math.sin(-secondAng));
        //
        // return this.getDistance(firstBody, secondBody);
    }

    drawText(name, x, y) {
        const text = new PIXI.Text(name, {
            fontFamily: 'Garamond',
            fontSize: 20,
            fill: 0x99c9ac,
            align: 'center'
        });

        text.position.x = x;
        text.position.y = y;
        this.app.stage.addChild(text);

        return text;
    }

    drawTargetPlanetZodiac() {
        const size = 275;

        const targetPlanetContainer = new PIXI.Container();
        targetPlanetContainer.name = 'targetPlanetZodiac';
        targetPlanetContainer.position = new PIXI.Point(WIDTH / 2, HEIGHT / 2);

        const targetPlanetImage = new PIXI.Sprite(PIXI.Texture.from('img/grey-circle.png'));
        targetPlanetImage.anchor.set(0.5);
        targetPlanetImage.width = size;
        targetPlanetImage.height = size;
        targetPlanetContainer.addChild(targetPlanetImage);

        this.app.stage.addChild(targetPlanetContainer);

        return targetPlanetContainer;
    }

    getDistance(firstBody, secondBody) {
        let diffX = Math.pow((firstBody.x - secondBody.x), 2);
        let diffY = Math.pow((firstBody.y - secondBody.y), 2);

        return Math.sqrt(diffX + diffY);
    }

    getTargetAngle() {

    }

    getElongationAngle() {

        // this.drawTargetPlanetSize(distObserverTarget, this.props.longitudes.ecliptic_longitude);
        this.drawTargetPlanetSize(2, this.props.longitudes.elongationAngle);
    }

    drawTargetPlanetSize(separationDistance, targetElongation) {
        const maxPixelSize = 275;

        // const minDist = Math.abs(this.props.radiusTargetPlanet - this.props.radiusObserverPlanet);
        // const maxDist = this.props.radiusObserverPlanet + this.props.radiusTargetPlanet;

        const minDist = 1;
        const maxDist = 6;

        const linearMinPix = d3.scaleLinear()
            .domain([0.5, 20])
            .range([150, 20]);

        // const minRadius = Math.min(this.props.radiusAUObserver, this.props.radiusAUTarget);
        const minRadius = 2;
        const minPix = linearMinPix(minRadius * 2);

        const linearPix = d3.scaleLinear()
            .domain([maxDist, minDist])
            .range([maxPixelSize, maxPixelSize]);

        // const targetPlanetSize = linearPix(separationDistance);
        const targetPlanetSize = this.props.longitudes.size;
        this.targetPlanet.width = targetPlanetSize;
        this.targetPlanet.height = targetPlanetSize;

        this.hiddenTargetPlanet.visible = true;
        this.drawPhase(this.leftShade, this.rightShade, this.convertPhase(targetElongation), 1.002 * (targetPlanetSize / 2));
    }

    animate() {
        this.getElongationAngle();
        this.updateTexts(this.props.longitudes.elongationAngle);
    }

    updateTexts(elongationAngle) {
        // this.distanceText.text = `observer-target distance:\n${Math.round(this.getDistanceBetweenBodies() * 100) / 100} au`;

        let num = elongationAngle * 180 / Math.PI;

        let direction = 'E';
        if (num > 180) {
            let temp = num - 180;
            num -= temp * 2;
            direction = 'W ';
        }

        if (num === 0 || num === 180) {
            direction = '';
        }

        let textNum = String(" " + num.toFixed(0)).slice(-6);
        textNum += '°';

        this.elongationText.text = `Elongation: ${textNum}`;
        this.elongationDirectionText.text = direction;
    }

    drawShades() {
        const size = 275;
        const radius = size / 2;

        this.leftShade = new PIXI.Graphics();
        this.leftShade.pivot = this.center;
        this.rightShade = new PIXI.Graphics();
        this.rightShade.pivot = this.center;

        this.leftShade.beginFill(0x000000, 0.7);
        this.leftShade.arc(this.center.x * 2, this.center.y * 2,
            radius, Math.PI / 2, -Math.PI / 2);
        this.leftShade.endFill();

        this.app.stage.addChild(this.leftShade);

        this.rightShade.beginFill(0x000000, 0.7);
        this.rightShade.arc(this.center.x * 2, this.center.y * 2,
            radius, -Math.PI / 2, Math.PI / 2);
        this.rightShade.endFill();

        this.app.stage.addChild(this.rightShade);

        const hiddenTargetPlanet = new PIXI.Sprite( PIXI.Texture.from('img/grey-circle.png') );
        hiddenTargetPlanet.anchor.set(0.5);
        hiddenTargetPlanet.width = size;
        hiddenTargetPlanet.height = size;
        hiddenTargetPlanet.visible = false;
        hiddenTargetPlanet.position = new PIXI.Point(WIDTH / 2, HEIGHT / 2);

        this.app.stage.addChild(hiddenTargetPlanet);
        this.hiddenTargetPlanet = hiddenTargetPlanet;
    }

    drawPhase(leftShade, rightShade, phase, radius) {
        this.leftShade.clear();
        this.leftShade.beginFill(0x000000, 0.7);
        this.leftShade.arc(this.center.x * 2, this.center.y * 2,
            radius, Math.PI / 2, -Math.PI / 2);
        this.leftShade.endFill();

        this.rightShade.clear();
        this.rightShade.beginFill(0x000000, 0.7);
        this.rightShade.arc(this.center.x * 2, this.center.y * 2,
            radius, -Math.PI / 2, Math.PI / 2);
        this.rightShade.endFill();

        this.hiddenTargetPlanet.width = radius * 2;
        this.hiddenTargetPlanet.height = radius * 2;

        if (phase <= 0.5) {
            const scale = 1 - (phase * 4);
            leftShade.scale.x = 1;
            leftShade.position.x = 0;
            rightShade.scale.x = scale;
            rightShade.position.x = this.center.x - (scale * this.center.x);

            if (phase > 0.25) {
                this.hiddenTargetPlanet.mask = this.rightShade;
                this.hiddenTargetPlanet.visible = true;
            } else {
                this.hiddenTargetPlanet.mask = null;
                this.hiddenTargetPlanet.visible = false;
            }
        } else {
            const scale = -phase * 4 + 3;

            rightShade.scale.x = 1;
            rightShade.position.x = 0;

            if (phase < 0.75) {
                this.hiddenTargetPlanet.mask = this.leftShade;
                this.hiddenTargetPlanet.visible = true;
                leftShade.scale.x = -scale;
                leftShade.position.x = this.center.x - (-scale * this.center.x);
            } else {
                this.hiddenTargetPlanet.mask = null;
                this.hiddenTargetPlanet.visible = false;
                leftShade.scale.x = -scale;
                leftShade.position.x =  this.center.x - (-scale * this.center.x);
                rightShade.scale.x = 1;
                rightShade.position.x = 0;
            }
        }
    }

    convertPhase(moonPhase) {
        const phase = (moonPhase - Math.PI) / (Math.PI * 2);
        if (phase > 1) {
            return 0;
        }
        if (phase < 0) {
            return phase + 1;
        }
        return phase;
    }
}
