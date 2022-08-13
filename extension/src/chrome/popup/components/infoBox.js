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
      const fediverse = config.WEB_ROOT + '/fediverse';

      return (
        <Card>
          <CardActions style={{ justifyContent: 'center' }}>
            <Button size="small" color="secondary" href={about} target="_blank">
              about
            </Button>
            <Button size="small" color="primary" href={privacy} target="_blank">
              privacy
            </Button>
            <Button size="small" color="secondary" href="https://github.com/tracking-exposed/librevent/" target="_blank">
              code
            </Button>
            <Button size="small" color="primary" href={fediverse} target="_blank">
              fediverse
            </Button>
            <Button size="small" color="secondary" href="https://www.youtube.com/watch?v=F5xwZ0olSqA" target="_blank">
              disappear
            </Button>
          </CardActions>
        </Card>
      );
    }
});

export default InfoBox;
