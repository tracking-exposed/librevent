import React from 'react';
import config from '../../../config';

import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import StayCurrentLandscapeIcon from '@material-ui/icons/StayCurrentLandscape';
import OndemandVideoIcon from '@material-ui/icons/OndemandVideo';
import AccountBoxIcon from '@material-ui/icons/AccountBox';
import List from '@material-ui/core/List';

function ListItemLink (props) {
    return <ListItem component="a" {...props} />;
}

class InfoBox extends React.Component {
    render () {
        const eventcsv = config.API_ROOT + '/personal/' + this.props.publicKey + '/events' + '/csv';
        const previewcsv = config.API_ROOT + '/personal/' + this.props.publicKey + '/previews' + '/csv';
        const personalLink = config.WEB_ROOT + '/personal/#' + this.props.publicKey;

        return (
          <List component="nav" aria-label="controls links files">

            <ListItem button>
              <ListItemIcon>
                <AccountBoxIcon />
              </ListItemIcon>
              <ListItemLink href={personalLink} target="_blank">More on the events you liberated</ListItemLink>
            </ListItem>

          </List>
        );
        /*
            <ListItem button>
              <ListItemIcon>
                <StayCurrentLandscapeIcon />
              </ListItemIcon>
              <ListItemLink href={eventcsv} target="_blank">Download CSV</ListItemLink>
            </ListItem>

            <ListItem button>
              <ListItemIcon>
                <OndemandVideoIcon />
              </ListItemIcon>
              <ListItemLink href={previewcsv} target="_blank">Event Previews CSV</ListItemLink>
            </ListItem>
          */
    }
};

export default InfoBox;
