const buttonPressResetTime = 300000; // 5 minutes in milliseconds

app.get('/api/button', async (req, res) => {
  if (!await handleAuth(req)) {
    return res.send('You are not authenticated!');
  }
  const userId = req.session.userId; // Assuming you store a persistent user ID in the session

  try {
    // Retrieve the last button press record for the user from the database
    const lastPress = await getLastButtonPress(userId);
    const currentTime = Date.now();

    // If the user does not exist in the database or the reset time has passed
    if (!lastPress || currentTime - lastPress.last_pressed.getTime() > buttonPressResetTime) {
      // Reset the count and timestamp in the database
      await resetButtonPressCount(userId, new Date(currentTime));
      req.session.buttonPresses = 1; // Optional: Update the session for immediate subsequent checks
    } else if (lastPress.count < 1) {
      // If the count is below the limit, increment in the database
      await incrementButtonPressCount(userId);
      req.session.buttonPresses = lastPress.count + 1; // Optional: Update the session for immediate subsequent checks
    } else {
      // Limit reached
      const resetTime = new Date(lastPress.last_pressed.getTime() + buttonPressResetTime);
      return res.send(`Button press limit reached.\nLimit expires at: ${resetTime}`);
    }

    // Call the serverButtonRandom function and send the response
    await serverButtonRandom();
    res.send(global.minecraftresponse);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred.');
  }
});


app.get('/button', async (req, res) => {
  res.render('button', {username: req.session.username,navbar: `
  <li class="nav-item">
  <a class="nav-link" aria-current="page" href="/">Home</a>
  </li>
  `});
});

async function serverButtonRandom() {
  const rcon = await Rcon.connect(config_mcRcon);

  // Commands with their corresponding weights
  const weightedCommands = [
    { command: 'time add 12000', weight: 20 },
    { command: 'weather rain', weight: 20 },
    { command: 'weather thunder', weight: 20 },
    { command: 'weather clear', weight: 20 },
    { command: 'say Did anyone see my pet creeper?', weight: 10 },
    { command: 'summon creeper ~ ~ ~ {CustomName:"\\"Jerry\\""}', weight: 5 },
    { command: 'tellraw @a {"text":"Someone pressed a button with malicious intent!", "color":"red"}', weight: 20 },
    { command: 'particle heart ~ ~1 ~ 0.5 0.5 0.5 0 10 normal @a', weight: 15 },
    { command: 'playsound minecraft:entity.parrot.imitate.ender_dragon ambient @a ~ ~ ~', weight: 8 },
    { command: 'title @a title {"text":"Look out! Flying pig!", "bold":true, "color":"red"}', weight: 5 },
    { command: 'summon pig ~ ~ ~ {NoAI:1b,Passengers:[{id:"minecraft:firework_rocket",LifeTime:20}]}', weight: 5 },
    { command: 'give @r minecraft:elytra{display:{Name:"{\\"text\\":\\"Wings of Destiny\\"}",Lore:["{\\"text\\":\\"Soar above the clouds!\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:dragon_egg', weight: 0.5 },
    { command: 'give @r minecraft:totem_of_undying{display:{Name:"{\\"text\\":\\"Charm of Life\\"}",Lore:["{\\"text\\":\\"Cheat death, if only once.\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:beacon{display:{Name:"{\\"text\\":\\"Beacon of Hope\\"}",Lore:["{\\"text\\":\\"Light up your world!\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:nether_star{display:{Name:"{\\"text\\":\\"Star of the Nether\\"}",Lore:["{\\"text\\":\\"A piece of the abyss.\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:command_block{display:{Name:"{\\"text\\":\\"Block of Commanding\\"}",Lore:["{\\"text\\":\\"What will you create?\\"}"]}}', weight: 0.05 },
    { command: 'give @r minecraft:heart_of_the_sea{display:{Name:"{\\"text\\":\\"Salt Baller\\"}",Lore:["{\\"text\\":\\"The sea`s balls await.\\"}"]}}', weight: 1 },
    { command: 'say If you find a pool of lava, don’t walk into it. It’s not a hot tub!', weight: 18 },
    { command: 'effect give @r minecraft:slowness 30 1 true', weight: 0.2 },
    { command: 'summon zombie ~ ~ ~ {CustomName:"\\"Mini Boss\\"",ArmorItems:[{},{},{},{id:"minecraft:diamond_helmet",Count:1b}],HandItems:[{id:"minecraft:diamond_sword",Count:1b},{}],Attributes:[{Name:"generic.maxHealth",Base:50.0},{Name:"generic.attackDamage",Base:5.0}],Invulnerable:1b,Silent:0b,NoAI:0b}', weight: 0.1 },
    { command: 'execute at @r run fill ~-2 ~-1 ~-2 ~2 ~-1 ~2 minecraft:lava', weight: 0.1 },
    { command: 'give @r minecraft:written_book{pages:["{\\"text\\":\\"You shouldn\'t have pressed that button...\\",\\"color\\":\\"dark_red\\",\\"bold\\":true}"],title:"Bad Luck",author:"The Server"}', weight: 0.2 },
    { command: 'execute at @r run tp @s ~ ~100 ~', weight: 0.1 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:spawner{SpawnData:{id:"Creeper"}}', weight: 0.1 },
    { command: 'give @p minecraft:cookie{display:{Name:"{\\"text\\":\\"Fortune Cookie\\"}"},Lore:["{\\"text\\":\\"Break for a surprise!\\"}"]}', weight: 7 },
    { command: 'give @r minecraft:cake', weight: 15 },
    { command: 'summon chicken ~ ~ ~ {NoAI:1b,CustomName:"\\"Dinnerbone\\""}', weight: 15 },
    { command: 'execute at @r run particle cloud ~ ~ ~ 0.5 0.5 0.5 0.01 100 normal', weight: 15 },
    { command: 'tellraw @a {"text":"It\'s raining cats and dogs! (not really)"}', weight: 15 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:jukebox', weight: 15 },
    { command: 'give @r minecraft:pumpkin_pie', weight: 15 },
    { command: 'execute at @r run summon boat ~ ~ ~', weight: 15 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:flower_pot{Item:"minecraft:red_flower"}', weight: 15 },
    { command: 'execute at @r run summon armor_stand ~ ~ ~ {CustomName:"\\"Invisible Friend\\"",Invisible:1b,Invulnerable:1b}', weight: 10 },
    { command: 'execute at @r run summon bat ~ ~ ~ {CustomName:"\\"Dracula\\"",Invulnerable:1b}', weight: 10 },
    { command: 'execute at @r run summon rabbit ~ ~ ~ {RabbitType:99,CustomName:"\\"The Killer Bunny\\"",Invulnerable:1b}', weight: 5 },
    { command: 'execute at @r run summon pig ~ ~ ~ {CustomName:"\\"Pigasus\\"",Invulnerable:1b,NoAI:1b,Saddle:1b}', weight: 10 },
    { command: 'execute at @r run summon villager ~ ~ ~ {CustomName:"\\"The Wanderer\\"",Profession:2,Career:1}', weight: 10 },
    { command: 'execute at @r run summon llama ~ ~ ~ {CustomName:"\\"Drama Llama\\"",Tame:1b,DecorItem:{id:"minecraft:carpet",Count:1b,Damage:14s}}', weight: 10 },
    { command: 'execute at @r run summon wolf ~ ~ ~ {CustomName:"\\"Doggo\\"",OwnerUUID:"@p",CollarColor:14}', weight: 10 },
    { command: 'execute at @r run summon cat ~ ~ ~ {CustomName:"\\"Mr. Whiskers\\"",CatType:1,Invulnerable:1b}', weight: 10 },
    { command: 'execute at @r run summon firework_rocket ~ ~ ~ {LifeTime:20,FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Explosions:[{Type:4,Colors:[I;16711680],FadeColors:[I;16776960]}]}}}}', weight: 10 },
    { command: 'execute at @r run summon tnt ~ ~ ~ {Fuse:80}', weight: 5 },
    { command: 'execute at @r run summon ender_pearl ~ ~ ~ {owner:@p}', weight: 10 },
    { command: 'execute at @r run summon area_effect_cloud ~ ~ ~ {Particle:"end_rod",Radius:3f,Duration:200}', weight: 10 },
    { command: 'execute at @r run summon falling_block ~ ~ ~ {BlockState:{Name:"minecraft:anvil"},Time:1}', weight: 5 },
    { command: 'execute at @r run summon armor_stand ~ ~ ~ {CustomName:"\\"Stand By Me\\"",NoGravity:1b,ShowArms:1b}', weight: 10 },
    { command: 'execute at @r run summon lightning_bolt', weight: 2 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:chest{LootTable:"chests/simple_dungeon"}', weight: 10 },
    { command: 'give @r minecraft:firework_rocket{Fireworks:{Flight:3b,Explosions:[{Type:4,Flicker:1,Trail:1,Colors:[I;11743532],FadeColors:[I;15435844]}]}}', weight: 5 },
    { command: 'execute at @r run summon ender_dragon ~ ~ ~', weight: 0.001 },
    { command: 'execute at @r run summon wither ~ ~ ~', weight: 0.005 },
    { command: 'execute at @r run summon giant ~ ~ ~', weight: 0.05 },
    { command: 'execute at @r run summon shulker ~ ~ ~ {NoAI:1b}', weight: 5 },
    { command: 'execute at @r run summon vex ~ ~ ~ {BoundX:~10,BoundY:~5,BoundZ:~10,LifeTicks:1200}', weight: 5 },
    { command: 'execute at @r run summon evoker ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon vindicator ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon illusioner ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon elder_guardian ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon polar_bear ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon panda ~ ~ ~ {MainGene:"lazy",HiddenGene:"worried"}', weight: 10 },
    { command: 'execute at @r run summon parrot ~ ~ ~ {Variant:4}', weight: 10 },
    { command: 'execute at @r run summon horse ~ ~ ~ {Tame:1b,Color:3,Variant:769,ArmorItem:{id:"minecraft:diamond_horse_armor",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon villager ~ ~ ~ {VillagerData:{profession:"librarian",level:2,type:"plains"}}', weight: 10 },
    { command: 'execute at @r run summon zombie_villager ~ ~ ~ {VillagerData:{profession:"farmer",level:2,type:"desert"}}', weight: 10 },
    { command: 'execute at @r run summon zombie_horse ~ ~ ~ {Tame:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon skeleton_horse ~ ~ ~ {Tame:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon donkey ~ ~ ~ {Tame:1b,ChestedHorse:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon mule ~ ~ ~ {Tame:1b,ChestedHorse:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon llama ~ ~ ~ {Tame:1b,Strength:5,DecorItem:{id:"minecraft:carpet",Count:1b,Damage:4s}}', weight: 10 },
    { command: 'execute at @r run summon trader_llama ~ ~ ~ {Tame:1b,Strength:5,DecorItem:{id:"minecraft:carpet",Count:1b,Damage:4s}}', weight: 10 },
    { command: 'execute at @r run summon dolphin ~ ~ ~ {CanPickUpLoot:1b,NoAI:1b}', weight: 10 },
    { command: 'execute at @r run summon turtle ~ ~ ~ {HomePosX:~10,HomePosY:~,HomePosZ:~10}', weight: 10 },
    { command: 'execute at @r run summon phantom ~ ~ ~ {Size:5}', weight: 5 },
    { command: 'execute at @r run summon cod ~ ~ ~ {NoAI:1b}', weight: 15 },
    { command: 'execute at @r run summon salmon ~ ~ ~ {NoAI:1b}', weight: 15 },
    { command: 'execute at @r run summon pufferfish ~ ~ ~ {NoAI:1b,Puffsptate:2}', weight: 15 },
    { command: 'execute at @r run summon tropical_fish ~ ~ ~ {NoAI:1b,Variant:12345678}', weight: 15 },
    { command: 'execute at @r run summon drowned ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon husk ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon stray ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon blaze ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon cave_spider ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon enderman ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon ghast ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon magma_cube ~ ~ ~ {Size:3}', weight: 5 },
    { command: 'execute at @r run summon slime ~ ~ ~ {Size:3}', weight: 5 },
    { command: 'execute at @r run summon witch ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon guardian ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon elder_guardian ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon shulker ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon silverfish ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon skeleton ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon spider ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zombie ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zombie_pigman ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon pillager ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon ravager ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon hoglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon piglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zoglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon piglin_brute ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon strider ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zombified_piglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon fox ~ ~ ~ {Type:"red"}', weight: 10 },
    { command: 'execute at @r run summon ocelot ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon wolf ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon bee ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon iron_golem ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon snow_golem ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon mooshroom ~ ~ ~ {Type:"red"}', weight: 10 },
    { command: 'execute at @r run summon cow ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon pig ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon sheep ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon chicken ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon squid ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon bat ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon rabbit ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon llama ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon parrot ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon villager ~ ~ ~', weight: 10 },
    { command: 'setblock ~ ~ ~ minecraft:chest{LootTable:"chests/igloo_chest"}', weight: 10 },
    { command: 'fill ~1 ~-1 ~1 ~-1 ~-1 ~-1 minecraft:water', weight: 1 },
    { command: 'clone ~ ~ ~ ~10 ~10 ~10 ~20 ~ ~ replace move', weight: 0.5 },
    { command: 'setworldspawn ~ ~ ~', weight: 0.05 },
    { command: 'spreadplayers ~ ~ 50 100 false @a', weight: 10 },
    { command: 'data merge block ~ ~ ~ {Text1:"{\\"text\\":\\"Welcome to the server!\\"}",Text2:"{\\"text\\":\\"Enjoy your stay\\"}",Text3:"{\\"text\\":\\"Don\'t forget to read the rules!\\"}",Text4:"{\\"text\\":\\"Have fun!\\"}"}', weight: 5 },
    { command: 'playsound minecraft:block.note_block.harp master @a ~ ~ ~ 1 2', weight: 10 },
    { command: 'playsound minecraft:block.note_block.bass master @a ~ ~ ~ 1 0.5', weight: 10 },
    { command: 'playsound minecraft:block.note_block.pling master @a ~ ~ ~ 1 1.5', weight: 10 },
    { command: 'playsound minecraft:block.note_block.bell master @a ~ ~ ~ 1 1', weight: 10 },
    { command: 'playsound minecraft:block.note_block.flute master @a ~ ~ ~ 1 0.7', weight: 10 },
    { command: 'playsound minecraft:block.note_block.guitar master @a ~ ~ ~ 1 0.6', weight: 10 },
    { command: 'playsound minecraft:block.note_block.xylophone master @a ~ ~ ~ 1 1.2', weight: 10 },
    { command: 'playsound minecraft:block.note_block.iron_xylophone master @a ~ ~ ~ 1 1.3', weight: 10 },
    { command: 'playsound minecraft:block.note_block.cow_bell master @a ~ ~ ~ 1 1.4', weight: 10 },
    { command: 'playsound minecraft:block.note_block.didgeridoo master @a ~ ~ ~ 1 1.6', weight: 10 },
    { command: 'playsound minecraft:block.note_block.bit master @a ~ ~ ~ 1 1.7', weight: 10 },
    { command: 'playsound minecraft:block.note_block.banjo master @a ~ ~ ~ 1 1.8', weight: 10 },
    { command: 'playsound minecraft:block.note_block.pling master @a ~ ~ ~ 1 1.9', weight: 10 },
    { command: 'effect give @a minecraft:night_vision 10000 1 true', weight: 5 },
    { command: 'effect give @a minecraft:invisibility 10000 1 true', weight: 5 },
    { command: 'effect give @a minecraft:jump_boost 6000 5 true', weight: 5 },
    { command: 'effect give @a minecraft:speed 6000 5 true', weight: 5 },
    { command: 'effect give @a minecraft:fire_resistance 6000 0 true', weight: 5 },
    { command: 'effect give @a minecraft:haste 6000 2 true', weight: 5 },
    { command: 'effect give @a minecraft:strength 6000 5 true', weight: 5 },
    { command: 'effect give @a minecraft:regeneration 6000 2 true', weight: 5 },
    { command: 'effect give @a minecraft:resistance 6000 4 true', weight: 5 },
    { command: 'effect give @a minecraft:water_breathing 6000 0 true', weight: 5 },
    { command: 'effect give @a minecraft:levitation 100 1 true', weight: 1 },
    { command: 'enchant @p sharpness 5', weight: 5 },
    { command: 'enchant @p efficiency 5', weight: 5 },
    { command: 'enchant @p unbreaking 3', weight: 5 },
    { command: 'enchant @p fortune 3', weight: 5 },
    { command: 'enchant @p mending 1', weight: 5 },
    { command: 'enchant @p flame 1', weight: 5 },
    { command: 'enchant @p looting 3', weight: 5 },
    { command: 'enchant @p silk_touch 1', weight: 5 },
    { command: 'xp add @a 50 levels', weight: 10 },
    { command: 'xp add @a 1000 points', weight: 10},
    { command: 'give @p diamond 2', weight: 1 }
  ];
  
  // Function to select a command based on weights
  function selectWeightedCommand(weightedCommands) {
    const totalWeight = weightedCommands.reduce((total, cmd) => total + cmd.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const item of weightedCommands) {
      if (randomNum < item.weight) {
        return item.command;
      }
      randomNum -= item.weight;
    }
  }

  // Select a command using the weighted function
  const randomCommand = selectWeightedCommand(weightedCommands);

  // Send the selected command to the server and wait for the response
  let response = await rcon.send(randomCommand);
  if (response.length < 2) {
    response = randomCommand;
  }
  global.minecraftresponse = response;

  rcon.end();
}