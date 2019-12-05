def add_time(intput_time,a_list):
    new_list =[]
    for i in a_list:
        i_time = int(alist.index(i))+int(intput_time)
        new_list.append((str(i)+":"+str(i_time)))
    return new_list
alist =["a","b","c","d"]
time = 9

print(add_time(time,alist))
