<?php

include 'include/settings.php';
if (isset($_POST['name']) && isset($_POST['contactEmail']) && isset($_POST['message'])) {
    $name = $_POST['name'];
    $from = $_POST['contactEmail'];
    $message = $_POST['message'];

    $subject = 'Message from '.$name;

    if (mail($to, $subject, $message, $from)) {
        $response = ['sent' => 1];
        echo json_encode($response);
    } else {
        $response = ['sent' => 0];
        echo json_encode($response);
    }
}
