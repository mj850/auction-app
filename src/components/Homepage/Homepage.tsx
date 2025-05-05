import { ConnectButton } from '@rainbow-me/rainbowkit';
import Examples from './Examples';
import "./Homepage.css"

function Homepage() {

	return (
      <div className="container">
		<img src="sei-logotype.svg" className="logo" alt="SEI logotype" />
		<div className="card intro">
            <div className="card-header">
              <p className="card__title">Wallet address</p>
              <small className="card__description">
                Connect wallet to see your address and balance
              </small>
            </div>
            <ConnectButton/>
        </div>
		<Examples />
      </div>
	);
}

export default Homepage;
