import { expect, ethers } from '../setup';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

async function deployFixture() {
  const [owner, notOwner] = await ethers.getSigners();

  // Deploy implementations
  const token = await ethers.deployContract('ERC721Metadata', ["Token Metadata", "TKMTD"], owner);
  await token.waitForDeployment();

  return {
    owner,
    notOwner,
    token
  }
}

async function deployWithMintedTokenFixture() {
  const fixture = await deployFixture();
  await fixture.token['mint(address,string)'](fixture.owner.getAddress(), "ipfs://somelocation");

  return fixture;
}

describe('ERC721Metadata', () => {
  describe('.getMetadata(uint256)', () => {
    describe('when there is no metadata', () => {
      it('should return empty array', async () => {
        const { token } = await loadFixture(deployFixture);

        expect(await token['getMetadata(uint256)'](1)).to.deep.equal([]);
      });
    });

    describe('when there is metadata', () => {
      it('should return metadata list', async () => {
        const { token } = await loadFixture(deployWithMintedTokenFixture);

        await token['setMetadata(uint256,string,string)'](0, "color", "blue");
        await token['setMetadata(uint256,string,string)'](0, "position", "up");

        expect(await token['getMetadata(uint256)'](0)).to.deep.equal([['color', 'blue', true], ['position', 'up', true]]);
      });
    });
  });

  describe('.getMetadata(uint256,string)', () => {
    describe('when there is no metadata', () => {
      it('should return empty object', async () => {
        const { token } = await loadFixture(deployFixture);

        expect(await token['getMetadata(uint256,string)'](1, 'key')).to.deep.equal(['', '', false]);
      });
    });

    describe('when there is metadata', () => {
      it('should return metadata', async () => {
        const { token } = await loadFixture(deployWithMintedTokenFixture);

        await token['setMetadata(uint256,string,string)'](0, "color", "blue");        

        expect(await token['getMetadata(uint256,string)'](0, 'color')).to.deep.equal(['color', 'blue', true]);
      });
    });
  });

  describe('.setMetadata(uint256,string,string)', () => {
    describe('when there is no token', () => {
      it('should revert', async () => {
        const { token } = await loadFixture(deployFixture);

        await expect(token['setMetadata(uint256,string,string)'](1, 'color', 'blue')).to.be.rejectedWith("ERC721NonexistentToken");
      });

    });
    describe('when there is token', () => {
      describe('when it is not the token owner', () => {
        it('should revert', async () => {
          const { token, notOwner } = await loadFixture(deployWithMintedTokenFixture);
          await expect(token.connect(notOwner)['setMetadata(uint256,string,string)'](0, 'color', 'blue')).to.be.revertedWith("ERC721Metadata: not token owner");
        });
      });

      describe('when it is the token owner', () => {
        describe('when the token is freezed', () => {
          it('should revert', async () => {
            const { token } = await loadFixture(deployWithMintedTokenFixture);
            await token.freezeMetadata(0);
            await expect(token['setMetadata(uint256,string,string)'](0, 'color', 'blue')).to.be.revertedWith("ERC721Metadata: token metadata can no longer be modified");
          });
        });

        describe('when the token is not freezed', () => {
          it('should set metadata', async () => {
            const { token } = await loadFixture(deployWithMintedTokenFixture);

            await token['setMetadata(uint256,string,string)'](0, "color", "red");      
            expect(await token['getMetadata(uint256,string)'](0, 'color')).to.deep.equal(['color', 'red', true]); 
          });

          it('should upsert when key already exists', async () => {
            const { token } = await loadFixture(deployWithMintedTokenFixture);

            await token['setMetadata(uint256,string,string)'](0, "color", "red");      
            await token['setMetadata(uint256,string,string)'](0, "color", "gray");      
            await token['setMetadata(uint256,string,string)'](0, "color", "green");

            expect(await token['getMetadata(uint256,string)'](0, 'color')).to.deep.equal(['color', 'green', true]); 
          });

          it('should insert multiple key-values', async () => {
            const { token } = await loadFixture(deployWithMintedTokenFixture);

            await token['setMetadata(uint256,string,string)'](0, "color", "red");      
            await token['setMetadata(uint256,string,string)'](0, "direction", "down");      
            await token['setMetadata(uint256,string,string)'](0, "size", "5");

            expect(await token['getMetadata(uint256,string)'](0, 'color')).to.deep.equal(['color', 'red', true]); 
            expect(await token['getMetadata(uint256,string)'](0, 'direction')).to.deep.equal(['direction', 'down', true]); 
            expect(await token['getMetadata(uint256,string)'](0, 'size')).to.deep.equal(['size', '5', true]); 

            expect(await token['getMetadata(uint256)'](0)).to.deep.equal(
              [
                ['color', 'red', true], 
                ['direction', 'down', true],
                ['size', '5', true],
              ]
            );
          });
        });
      });
    });
  });

  describe('.setMetadata(uint256,string[],string[])', () => {
    describe('when there is no token', () => {
      it('should revert', async () => {
        const { token } = await loadFixture(deployFixture);

        await expect(token['setMetadata(uint256,string[],string[])'](1, ['color'], ['blue'])).to.be.rejectedWith("ERC721NonexistentToken");
      });

    });
    describe('when there is token', () => {
      describe('when it is not the token owner', () => {
        it('should revert', async () => {
          const { token, notOwner } = await loadFixture(deployWithMintedTokenFixture);
          await expect(token.connect(notOwner)['setMetadata(uint256,string[],string[])'](0, ['color'], ['blue'])).to.be.revertedWith("ERC721Metadata: not token owner");
        });
      });

      describe('when it is the token owner', () => {
        describe('when the token is freezed', () => {
          it('should revert', async () => {
            const { token } = await loadFixture(deployWithMintedTokenFixture);
            await token.freezeMetadata(0);
            await expect(token['setMetadata(uint256,string[],string[])'](0, ['color'], ['blue'])).to.be.revertedWith("ERC721Metadata: token metadata can no longer be modified");
          });
        });

        describe('when the token is not freezed', () => {
          describe('when the array length mismatch', () =>{
            it('should revert', async () => {
              const { token } = await loadFixture(deployWithMintedTokenFixture);
              await expect(token['setMetadata(uint256,string[],string[])'](0, ["color", "position"], ["red"])).to.be.revertedWith("ERC721Metadata: array length mismatch");      
            });
          });

          describe('when the array length is equal', () =>{
            it('should set metadata', async () => {
              const { token } = await loadFixture(deployWithMintedTokenFixture);

              await token['setMetadata(uint256,string[],string[])'](0, ["color"], ["red"]);      
              expect(await token['getMetadata(uint256,string)'](0, 'color')).to.deep.equal(['color', 'red', true]); 
            });

            it('should bulk upsert when key already exists', async () => {
              const { token } = await loadFixture(deployWithMintedTokenFixture);

              await token['setMetadata(uint256,string[],string[])'](0, ["color", "position", "size"], ["red", "left", "9"]);      
              await token['setMetadata(uint256,string[],string[])'](0, ["position", "size"], ["right", "10"]);      

              expect(await token['getMetadata(uint256,string)'](0, 'color')).to.deep.equal(['color', 'red', true]); 
              expect(await token['getMetadata(uint256,string)'](0, 'position')).to.deep.equal(['position', 'right', true]); 
              expect(await token['getMetadata(uint256,string)'](0, 'size')).to.deep.equal(['size', '10', true]); 
            });
          });
        });
      });
    });
  });

  describe('.freezeMetadata()', () => {
    describe('when it is not the owner', () => {
      it('should revert', async () => {
        const { token, notOwner } = await loadFixture(deployWithMintedTokenFixture);
        await expect(token.connect(notOwner).freezeMetadata(0)).to.be.rejectedWith("OwnableUnauthorizedAccount");
      });
    });

    describe('when it is the owner', () => {
      describe('when the token is frozen', () => {
        it('should revert', async () => {
          const { token } = await loadFixture(deployWithMintedTokenFixture);
          await token.freezeMetadata(0);
          await expect(token.freezeMetadata(0)).to.be.revertedWith("ERC721Metadata: token metadata can no longer be modified");
        });
      });

      describe('when the token is not frozen', () => {
        it('should freeze metadata', async () => {
          const { token } = await loadFixture(deployWithMintedTokenFixture);
          await token.freezeMetadata(0);
        });
      });
    });
  });

  describe('.mint(address,string)', () => {
    describe('when minter is not the owner', () => {
      it('should revert', async () => {
        const { token, notOwner }  = await loadFixture(deployFixture);
        await expect(token.connect(notOwner)['mint(address,string)'](notOwner.getAddress(), "ipfs://someLocation")).to.be.rejectedWith("OwnableUnauthorizedAccount");
      });
    });

    describe('when minter is the owner', () => {
      it('should mint token', async () => {
        const { token, owner }  = await loadFixture(deployFixture);
        await token['mint(address,string)'](owner.getAddress(), "ipfs://someLocation");

        expect(await token.balanceOf(owner.getAddress())).to.be.equal(1);
        expect(await token.ownerOf(0)).to.be.equal(await owner.getAddress());
        expect(await token.tokenURI(0)).to.be.equal("ipfs://someLocation");
      });
    });
  });

  describe('.mint(address,string,string[],string[])', () => {
    describe('when minter is not the owner', () => {
      it('should revert', async () => {
        const { token, notOwner }  = await loadFixture(deployFixture);
        await expect(
          token
            .connect(notOwner)
            ['mint(address,string,string[],string[])'](notOwner.getAddress(), "ipfs://someLocation", ["color"], ["blue"]))
              .to.be.rejectedWith("OwnableUnauthorizedAccount");
      });
    });

    describe('when minter is the owner', () => {
      describe('when the array length mismatch', () =>{
        it('should revert', async () => {
          const { token, owner } = await loadFixture(deployFixture);
          await expect(
            token['mint(address,string,string[],string[])'](owner.getAddress(), "ipfs://someotherlocation", ["color", "position"], ["red"])
          ).to.be.revertedWith("ERC721Metadata: array length mismatch");      
        });
      });

      describe('when the array length is correct', () =>{
        it('should mint token', async () => {
          const { token, owner }  = await loadFixture(deployFixture);
          await token['mint(address,string,string[],string[])'](owner.getAddress(), "ipfs://someLocation", ["color"], ["red"]);

          expect(await token.balanceOf(owner.getAddress())).to.be.equal(1);
          expect(await token.ownerOf(0)).to.be.equal(await owner.getAddress());
          expect(await token.tokenURI(0)).to.be.equal("ipfs://someLocation");
          expect(await token['getMetadata(uint256,string)'](0, "color")).to.be.deep.equal(["color", "red", true]);
        });
      });
    });
  });

  describe('.setTokenURI()', () => {
    describe('when it is not the token owner', () => {
      it('should revert', async () => {
        const { token, notOwner } = await loadFixture(deployWithMintedTokenFixture);
        await expect(token.connect(notOwner).setTokenURI(0, 'ipfs://newlocation')).to.be.rejectedWith("OwnableUnauthorizedAccount");
      });
    });

    describe('when it is the token owner', () => {
      describe('when the token is freezed', () => {
        it('should revert', async () => {
          const { token } = await loadFixture(deployWithMintedTokenFixture);
          await token.freezeMetadata(0);
          await expect(token.setTokenURI(0, 'ipfs://newlocation')).to.be.revertedWith("ERC721Metadata: token metadata can no longer be modified");
        });
      });

      describe('when the token is not freezed', () => {
        it('should set tokenURI', async () => {
          const { token } = await loadFixture(deployWithMintedTokenFixture);

          await token.setTokenURI(0, "ipfs://new-location");      
          expect(await token.tokenURI(0)).to.equal("ipfs://new-location"); 

          await token.setTokenURI(0, "ipfs://newest-location");     
          expect(await token.tokenURI(0)).to.equal("ipfs://newest-location"); 
        });
      });
    });
  });

  describe('.setCollectionMetadata()', () => {
    describe('when it is not the token owner', () => {
      it('should revert', async () => {
        const { token, notOwner } = await loadFixture(deployWithMintedTokenFixture);
        await expect(token.connect(notOwner).setCollectionMetadata(['type'], ['collection'])).to.be.rejectedWith("OwnableUnauthorizedAccount");
      });
    });

    describe('when it is the token owner', () => {
      describe('when a empty array is passed', () => {
        it('should revert', async () => {
          const { token, owner } = await loadFixture(deployWithMintedTokenFixture);
          await expect(token.connect(owner).setCollectionMetadata([], [])).to.be.revertedWith("ERC721Metadata: invalid array length");
        });
      });

      describe('when a valid array is passed', () => {
        it('should set collection metadata', async () => {
          const { token } = await loadFixture(deployWithMintedTokenFixture);        
          await token.setCollectionMetadata(['type'], ['custom-collection']);
        });
      });      
    });    
  });

  describe('.getCollectionMetadata()', () => {      
    it('should return collection metadata', async () => {
      const { token } = await loadFixture(deployWithMintedTokenFixture);
      await token.setCollectionMetadata(['type', 'description'], ['buildings', 'buildings collection'])

      expect(await token['getCollectionMetadata()']()).to.be.deep.equal(
        [
          ['type', 'buildings', true],
          ['description', 'buildings collection', true]
        ]
      );
    });
  });

  describe('.getCollectionMetadata(string)', () => {      
    it('should return collection metadata by key', async () => {
      const { token } = await loadFixture(deployWithMintedTokenFixture);
      await token.setCollectionMetadata(['type', 'description'], ['buildings', 'buildings collection'])

      expect(await token['getCollectionMetadata(string)']('type')).to.be.deep.equal(
          ['type', 'buildings', true],
      );
    });
  });

  describe('.filterTokens(string,string)', () => {
    it('should filter tokens', async () => {
      const { token, owner } = await loadFixture(deployFixture);
      
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location1', ['color', 'size', 'type'], ['blue', '3', 'fixed']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location2', ['color', 'size', 'type'], ['green', '3', 'relative']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location3', ['color', 'size', 'type'], ['red', '7', 'fixed']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location4', ['color', 'size', 'type'], ['blue', '4', 'relative']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location5', ['color', 'size', 'type'], ['yellow', '1', 'fixed']);

      const blueTokens = await token['filterTokens(string,string)']('color', 'blue');
      
      expect(blueTokens).to.deep.equal(
        [
          [
            0n,
            "ipfs://location1",
            await owner.getAddress(),
            [
              ['color', 'blue', true],
              ['size', '3', true],
              ['type', 'fixed', true],
            ]
          ],
          [
            3n,
            "ipfs://location4",
            await owner.getAddress(),
            [
              ['color', 'blue', true],
              ['size', '4', true],
              ['type', 'relative', true],
            ]
          ]
        ]
      )
    });
  })

  describe('.filterTokens(string[],string[])', () => {
    it('should filter tokens', async () => {
      const { token, owner } = await loadFixture(deployFixture);
      
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location1', ['color', 'size', 'type'], ['blue', '3', 'fixed']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location2', ['color', 'size', 'type'], ['green', '3', 'relative']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location3', ['color', 'size', 'type'], ['red', '7', 'fixed']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location4', ['color', 'size', 'type'], ['blue', '4', 'relative']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location5', ['color', 'size', 'type'], ['yellow', '1', 'fixed']);
      await token['mint(address,string,string[],string[])'](owner.getAddress(), 'ipfs://location6', ['color', 'size', 'type'], ['blue', '5', 'fixed']);

      const blueTokens = await token['filterTokens(string[],string[])'](['color', 'type', 'size'], ['yellow', 'fixed', '1']);
      
      expect(blueTokens).to.deep.equal(
        [
          [
            4n,
            "ipfs://location5",
            await owner.getAddress(),
            [
              ['color', 'yellow', true],
              ['size', '1', true],
              ['type', 'fixed', true],
            ]
          ]
        ]
      )
    });
  })
});
