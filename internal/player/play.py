import os
import sys
from pydub import AudioSegment
from pydub.playback import _play_with_simpleaudio
from pydub import effects
from mutagen.mp3 import MP3
import json
import random
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from datetime import datetime
import socket
import threading
import configus
import configus2


global playback_obj

HOST = '' 
PORT = 55062 # choose a port number greater than 1024
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM) # create a TCP socket
s.bind((HOST, PORT)) # bind the socket to the port
s.listen(1) # listen for incoming connections
# Thread to handle each "client_soc" connection

def handler(client_soc, client_address):
     try:
          while True:
               global playback_obj
               print('Connected by', client_address) # print the address of the client
               dataRequest = client_soc.recv(1024) # receive up to 1 KB of data
               result = dataRequest.decode('UTF-8')
               result = str(result).split()
               try:
                    conn = psycopg2.connect(**configus)
                    print("Connection successful!")
               except psycopg2.Error as e:
                    print(f"Error connecting to the database: {e}")
                    return
               cur = conn.cursor()
               try:
                    query1 = f"SELECT * FROM users WHERE username = '{result[0]}' AND password = '{result[1]}'"
                    cur.execute(query1)
               except Exception as e:
                    print(e)
               conn.commit()
               try:
                    db = cur.fetchall()
                    if len(db) != 0:
                         print(db)
                         print(result)
                         if result[2] == 'skip':
                              response = 'skipped...'
                              client_soc.send(response.encode())
                              playback_obj.stop()
                         else: 
                              print('ligma balls')
                              response = '42'
                              client_soc.send(response.encode())
                    else:
                         1
               except Exception as e:
                    response = 'fuck you'
                    print(e)
                    client_soc.send(response.encode())
               break
          
          conn.close()
          client_soc.close() # close the connection
          print(f"Connection {client_address} was closed succsessfully.")
     except ConnectionResetError:
          print(f'Connection {client_address} closed on clientside.')
def acceptor():
      while True:
               try:
                    client_soc, client_address = s.accept()
                    # Send each "client_soc" connection as a parameter to a thread.
                    t = threading.Thread(target=handler, args=(client_soc, client_address), daemon=True)
                    t.start()
               except BlockingIOError: # No connection is available
                    pass # Do nothing and continue the loop
t = threading.Thread(target=acceptor, args=(), daemon=True)
t.start()
#this function writes data to SQL for my experiment             

def writeDataToSQL(songAlbum, songArtist, songName, whenstarted, timeleft):
     conn = psycopg2.connect(**configus2)
     print("Connection successful!")
     cur = conn.cursor()
     query1 = "UPDATE radiotohtml SET albumname = %s"
     query2 = "UPDATE radiotohtml SET authorname = %s"
     query3 = "UPDATE radiotohtml SET musicname = %s"
     query4 = "UPDATE radiotohtml SET whenstarted = %s"
     query5 = "UPDATE radiotohtml SET timeleft = %s"
     cur.execute(query1, (str(songAlbum),))
     conn.commit()
     cur.execute(query2, (str(songArtist),))
     conn.commit()
     cur.execute(query3, (str(songName),))
     conn.commit()
     cur.execute(query4, (whenstarted),)
     conn.commit()
     cur.execute(query5, (timeleft),)
     conn.commit()
     conn.close()
     return

# this function is responsible for playing the music.
def Player():
     try:
          conn = psycopg2.connect(**configus2)
          print("Connection successful!")
     except psycopg2.Error as e:
          print(f"Error connecting to the database: {e}")
          return
     cur = conn.cursor()
     cur.execute('SELECT max(id) FROM music')
     maxQueueNumber = cur.fetchall()[0][0]
     print(maxQueueNumber)
     queueNumber = random.randint(1, maxQueueNumber) # generate a random queue number to choose the music
     # defining the custom playlist file
     customPlaylistJson = os.path.join('C:/Server/nodeJSweb/public/data/custom.json')
     AuthorNamesArr = ["Ryan Gosling", "Arnold Schwarzenegger", "Joe Biden", "Witness from Fryazino", "Zhenya Prigozhin", "Baskov", "Alec R.", "Ivan Chuvaev", "Father Grigori", "ligma", "Johann Sebastian Bach", "Karl","Jean-Luc Picard", "Gene Roddenberry", "Michael Bay", "John Cena", "Kim Jong Un", "Mao Zedong", "Winnie-the-Pooh", "The Bomb Bay", "The Broadway","Your mom", "Da ne umer on v konce Drive!", "Michael Jackson", "Robert Downey Jr", "Winston Churchill", "Steven Hawking", "Mozart"]
     dayNumber = datetime.now()
     cur.execute('SELECT * FROM music')
     filtered_list = cur.fetchall()
     while queueNumber != -1: # this while loop is responsible for changing tracks upon end.
          print(dayNumber)
          dayNumber = datetime.now()
          with open(customPlaylistJson) as f3:
               customPlaylist = json.loads(f3.read())

          print(f'current custom playist size is: {customPlaylist}' )   
          if len(customPlaylist) == 0: # first it checks whether the size of customplaylist file is equal to 2 bytes, if so, it's empty, and we play a random song
               missingName = random.choice(AuthorNamesArr)
               random_song = random.choice(filtered_list)
               activeSong = random_song[8] # we get the path to the song
               sound = AudioSegment.from_mp3(activeSong.replace("\\", "/")) # get the audio segment from the active song
               timeleft = ((sound.duration_seconds),)
               whenstarted = (datetime.now(),)
               audio = MP3(activeSong) # for metadata 
               songName = audio.get("TIT2", 'ligma')
               songArtist = audio.get("TPE1", missingName)
               songAlbum = audio.get("TALB", 'gigaballs')
               customPlaylist = os.path.getsize(customPlaylistJson)
               writeDataToSQL(songAlbum, songArtist, songName, whenstarted, timeleft)
               timeleft = int(sound.duration_seconds)
               print(timeleft)
               global playback_obj # THANK YOU BLYA
               host = "localhost"
               port = 55063

               # Create a socket object
               s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

               # Connect to the server
               s.connect((host, port))

               # Send a message
               message = random_song[0]
               s.sendall(str(message).encode())

               # Close the socket
               s.close()
               from pydub import effects

               # Load your MP3 file

               # Normalize the audio to a target dBFS (decibels relative to full scale)
               normalized_sound = effects.normalize(sound)

               # Export the normalized audio
               playback_obj = _play_with_simpleaudio(normalized_sound) #I AM GOING TO HANG MYSELF ON MY FUCKING HEADPHONE WIRES.
               while playback_obj.is_playing():
                    1 
          else:
               print('Custom playlist initialized')
               with open(customPlaylistJson) as f2:
                    existing_data = json.load(f2) 
                    i2 = 1
                    existing_data2 = []
                    for bub in existing_data:
                         bub['queueNumber'] = str(i2)
                         i2 = i2 + 1
                         existing_data2.append(bub)
                    # Append the data to the list
                    # Seek to the beginning and overwrite the file

                    with open(customPlaylistJson, "w") as f2:
                         json.dump(existing_data2, f2, indent=2)
                    with open(customPlaylistJson) as f2:
                         customData = json.load(f2)

                    # Assign a unique queue number to the new data


                    missingName = random.choice(AuthorNamesArr)
                    filtered_list = [d3 for d3 in customData if d3['queueNumber'] == '1'] # we choose a song with a corresponding queueNumber in the file
                    print(filtered_list)
                    activeSong = filtered_list[0]['songPath'] # we get the path to the song
                    print(activeSong)
                    sound = AudioSegment.from_mp3(activeSong.replace("\\", "/")) # get the audio segment from the active song
                    timeleft = ((sound.duration_seconds),)
                    whenstarted = (datetime.now(),)
                    audio = MP3(activeSong) # for metadata 
                    songName = audio.get("TIT2", 'ligma')
                    songArtist = audio.get("TPE1", missingName)
                    songAlbum = audio.get("TALB", 'gigaballs')
                    customPlaylist = os.path.getsize(customPlaylistJson)
                    writeDataToSQL(songAlbum, songArtist, songName, whenstarted, timeleft)
                    timeleft = int(sound.duration_seconds)
                    print(timeleft)
                    print(filtered_list)
                    host = "localhost"
                    port = 55063

                    # Create a socket object
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

                    # Connect to the server
                    s.connect((host, port))

                    # Send a message
                    message = str(songName) + '?/' + str(songArtist) + '?/' + str(songAlbum) + '?/' + str(whenstarted) + '?/' + str(timeleft)
                    s.sendall(message.encode())

                    # Close the socket
                    s.close()
                    playback_obj = _play_with_simpleaudio(sound) #I AM GOING TO HANG MYSELF ON MY FUCKING HEADPHONE WIRES.
                    while playback_obj.is_playing():
                         pass

                    customPlaylistJson = os.path.join('C:/Server/nodeJSweb/public/data/custom.json')
                    with open(customPlaylistJson) as f2:
                         existing_data = json.load(f2) 
                    i2 = 1
                    existing_data2 = []
                    for bub in existing_data:
                         bub['queueNumber'] = str(i2)
                         i2 = i2 + 1
                         existing_data2.append(bub)
                    # Append the data to the list
                    # Seek to the beginning and overwrite the file

                    with open(customPlaylistJson, "w") as f2:
                         json.dump(existing_data2, f2, indent=2)
                    with open(customPlaylistJson) as f2:
                         customData = json.load(f2)
                    try:
                         for chunk in customData:
                              if chunk["queueNumber"] == '1':
                                   customData.remove(chunk)

                              # Overwrite the original file with the modified data
                         with open(customPlaylistJson, "w") as file:
                              json.dump(customData, file, indent=4)  # Indent for readability
                    except:
                         print('Someone removed the track already... why...')
     # once the custom playlist is clear, we choose another random song.
          queueNumber = random.randint(1, maxQueueNumber)   
     # rinse and repeat
     return(1)

# make an integration with node.js API for my website /s
# le make a good system for turning off the script when it's a new day.