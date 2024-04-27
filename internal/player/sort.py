import os
from mutagen.mp3 import MP3
import json
from jinja2 import Template
import hashlib
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import configus2

def calculate_md5_large(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()



def collectInitialData():
    try:
        conn = psycopg2.connect(**configus2)
        print("Connection successful!")
    except psycopg2.Error as e:
        print(f"Error connecting to the database: {e}")
        return
    cur = conn.cursor()
    check = 0
    while(check == 0):
        userInput = input("Do you want to scan the music folder? Y/N? ")
        if userInput == "Y":
            check = 1
            path = "F:\\Share\\Music\\" # directory where all music is located
            queueNumber = 0
            # loop through the folder and its subfolders or someshit idk
            for root, dirs, files in os.walk(path):
            # loop through the files in each subfolder
                for file in files:
                # get the file extension
                    ext = os.path.splitext(file)[1]
                    if ext == ".mp3":
                        file_path = os.path.join(root, file)   
                        audio = MP3(file_path)
                        queueNumber = queueNumber + 1
                        print("Queue Number: " + str(queueNumber))
                        songName = audio.get("TIT2", 'ligma')
                        songArtist = audio.get("TPE1", 'ligma')
                        songAlbum = audio.get("TALB", 'gigaballs')
                        stringSongAlbum = str(songAlbum).replace(":", "").replace("/", "").replace("\\", "").replace("*", "").replace("?", "").replace("<", "").replace(">", "").replace(" ","").replace(".","").replace("'","")
                        songGenre = audio.get("TCON", 'ligmaballs')
                        albumCover = "/images/covers/" + str(stringSongAlbum) + "Cover.jpg"

                        md5_value = calculate_md5_large(file_path)
                        try:
                            cur.execute('INSERT INTO music (name, author, album, genre, path_to_cover, md5, local) VALUES (%s, %s, %s, %s, %s, %s, %s)', (str(songName), str(songArtist), str(songAlbum), str(songGenre), str(albumCover), md5_value, file_path))
                            conn.commit()
                        except Exception as e:
                            print(f'An error occured! \n {e}')
                            conn.commit()

                    else:
                        print("Ligma balls has happened with file: ", file) 
            
            print("Tracks in the folder: ", queueNumber)
            cur.close()
            conn.close()

        elif userInput == "N":
            print("Proceeding to next stage.")
            check = 1
        else:
            print("Please enter a valid answer...")
            check = 0

    return



        




 







