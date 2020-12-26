import React from 'react';
import config from '../../../config';
import createReactClass from 'create-react-class';

import { Card } from '@material-ui/core';
import CardActions from '@material-ui/core/CardActions';
import Button from '@material-ui/core/Button';



const InfoBox = createReactClass({

    render () {
        const about = config.WEB_ROOT + '/about';
        const privacy = config.WEB_ROOT + '/privacy';
        const experiments = config.WEB_ROOT + '/wetest/next';

        return (
            <Card style={{'textAlign':'center'}}>
              <CardActions>
                <Button size="small" color="secondary" href={about} target="_blank">
                  button1
                </Button>
                <Button size="small" color="primary" href={privacy} target="_blank">
                  button2
                </Button>
                <Button size="small" color="secondary" href="https://tracking.exposed/manifesto" target="_blank">
                  button3
                </Button>
                <Button size="small" color="primary"  href="https://github.com/tracking-exposed/yttrex/" target="_blank"> 
                  button4
                </Button>
                <Button size="small" color="secondary" href={experiments} target="_blank">
                  button5
                </Button>
              </CardActions>
            </Card>
        );
    }
});

export default InfoBox;
